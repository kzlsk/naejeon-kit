import { describe, expect, it } from "vitest";

import { AGENT_KEY_BY_UUID, AGENTS, type AgentKey } from "@/lib/constants";

import {
  aggregateRiotMatches,
  computeStats,
  type RiotMatch,
} from "./computeStats";

const ME = "puuid-me";

/** 요원 키 → 매치 데이터의 characterId */
const uuidOf = (key: AgentKey) =>
  Object.entries(AGENT_KEY_BY_UUID).find(([, k]) => k === key)![0];

type Shots = [head: number, body: number, leg: number];

/** 나는 Blue 팀. rounds 판 중 shots 는 첫 라운드에 몰아서 기록 */
function match({
  start = 0,
  won = true,
  score = 4000,
  rounds = 20,
  shots = [2, 7, 1] as Shots,
  queueId = "competitive",
  seasonId = "act-now",
  withMe = true,
  agent = "jett",
}: {
  start?: number;
  won?: boolean;
  score?: number;
  rounds?: number;
  shots?: Shots;
  queueId?: string;
  seasonId?: string;
  withMe?: boolean;
  agent?: AgentKey | "unknown";
} = {}): RiotMatch {
  const [headshots, bodyshots, legshots] = shots;
  return {
    matchInfo: { queueId, gameStartMillis: start, seasonId },
    players: [
      ...(withMe
        ? [
            {
              puuid: ME,
              teamId: "Blue",
              characterId: agent === "unknown" ? "no-such-uuid" : uuidOf(agent),
              stats: { score, roundsPlayed: rounds },
            },
          ]
        : []),
      {
        puuid: "other",
        teamId: "Red",
        characterId: uuidOf("omen"),
        stats: { score: 9999, roundsPlayed: rounds },
      },
    ],
    teams: [
      { teamId: "Blue", won },
      { teamId: "Red", won: !won },
    ],
    roundResults: [
      {
        playerStats: [
          { puuid: ME, damage: [{ headshots, bodyshots, legshots }] },
          // 남의 명중은 세지 않는다
          {
            puuid: "other",
            damage: [{ headshots: 50, bodyshots: 0, legshots: 0 }],
          },
        ],
      },
    ],
  };
}

describe("computeStats", () => {
  it("집계할 판이 없으면 null", () => {
    expect(computeStats([], ME)).toBeNull();
    expect(computeStats([match({ withMe: false })], ME)).toBeNull();
    expect(computeStats([match({ queueId: "unrated" })], ME)).toBeNull();
  });

  it("승률 · 평균 ACS(총 score ÷ 총 라운드) · 명중 부위 비율", () => {
    const s = computeStats(
      [
        match({ won: true, score: 5000, rounds: 20, shots: [3, 6, 1] }),
        match({ won: false, score: 3000, rounds: 20, shots: [1, 8, 1] }),
        match({ won: true, score: 4000, rounds: 10, shots: [0, 0, 0] }),
        match({ won: false, score: 0, rounds: 10, shots: [0, 0, 0] }),
      ],
      ME,
    );
    expect(s).toEqual({
      matchCount: 4,
      wins: 2,
      winRate: 0.5,
      avgAcs: 12000 / 60,
      headshotPct: 4 / 20,
      bodyshotPct: 14 / 20,
      legshotPct: 2 / 20,
    });
  });

  it("평균 ACS 는 판별 평균이 아니라 라운드 가중", () => {
    const s = computeStats(
      [
        match({ score: 300, rounds: 1 }), // 판 ACS 300
        match({ score: 900, rounds: 9 }), // 판 ACS 100
      ],
      ME,
    )!;
    expect(s.avgAcs).toBe(120); // (300 + 100) / 2 = 200 이 아님
  });

  it("경쟁전만, 최근 30판까지", () => {
    const matches = [
      ...Array.from({ length: 35 }, (_, i) =>
        // 최근 30판(start 5~34)은 승, 오래된 5판(start 0~4)은 패
        match({ start: i, won: i >= 5 }),
      ),
      match({ start: 100, queueId: "unrated", won: false }),
    ];
    const s = computeStats(matches, ME)!;
    expect(s.matchCount).toBe(30);
    expect(s.wins).toBe(30);
    expect(s.winRate).toBe(1);
  });

  it("seasonId 를 주면 그 액트만", () => {
    const s = computeStats(
      [
        match({ seasonId: "act-now", won: true }),
        match({ seasonId: "act-old", won: false }),
      ],
      ME,
      { seasonId: "act-now" },
    )!;
    expect(s.matchCount).toBe(1);
    expect(s.winRate).toBe(1);
  });

  it("명중·라운드 기록이 없어도 0 으로 (NaN 없음)", () => {
    const s = computeStats(
      [{ ...match({ shots: [0, 0, 0] }), roundResults: null, teams: null }],
      ME,
    )!;
    expect(s).toMatchObject({ winRate: 0, headshotPct: 0, legshotPct: 0 });
    expect(computeStats([match({ rounds: 0, score: 0 })], ME)!.avgAcs).toBe(0);
  });

  it("지표를 합친 점수 필드는 없다", () => {
    expect(Object.keys(computeStats([match()], ME)!).sort()).toEqual([
      "avgAcs",
      "bodyshotPct",
      "headshotPct",
      "legshotPct",
      "matchCount",
      "winRate",
      "wins",
    ]);
  });
});

describe("aggregateRiotMatches — 지표·요원·포지션이 같은 매치 집합", () => {
  const name = (k: AgentKey) => AGENTS[k];
  const gamesSum = (r: ReturnType<typeof aggregateRiotMatches>) =>
    r.topAgents.reduce((n, a) => n + a.games, 0);

  it("요원 판수 합 ≤ 지표 판 수, 같은 필터(경쟁전·이번 액트·최근 30판)", () => {
    const recent: AgentKey[] = Array.from({ length: 30 }, (_, i) =>
      i < 15 ? "jett" : i < 25 ? "sova" : "omen",
    );
    const matches = [
      // 최근 30판: 제트 15 · 소바 10 · 오멘 5
      ...recent.map((agent, i) => match({ start: 100 + i, agent })),
      // 30판 밖(오래됨) · 다른 액트 · 비경쟁전 — 요원 집계에도 들어가면 안 된다
      ...Array.from({ length: 10 }, (_, i) =>
        match({ start: i, agent: "sage" }),
      ),
      match({ start: 500, agent: "sage", seasonId: "act-old" }),
      match({ start: 501, agent: "sage", queueId: "unrated" }),
    ];
    const r = aggregateRiotMatches(matches, ME, { seasonId: "act-now" });

    expect(r.stats!.matchCount).toBe(30);
    expect(r.topAgents).toEqual([
      { agent: name("jett"), position: "duelist", games: 15 },
      { agent: name("sova"), position: "initiator", games: 10 },
      { agent: name("omen"), position: "controller", games: 5 },
    ]);
    expect(r.topPositions).toEqual(["duelist", "initiator"]);
    expect(gamesSum(r)).toBeLessThanOrEqual(r.stats!.matchCount);
  });

  it("stats 는 computeStats 와 같다", () => {
    const matches = [
      match({ start: 1, won: false }),
      match({ start: 2, seasonId: "act-old" }),
      match({ start: 3, shots: [5, 5, 0] }),
    ];
    const opts = { seasonId: "act-now" };
    expect(aggregateRiotMatches(matches, ME, opts).stats).toEqual(
      computeStats(matches, ME, opts),
    );
  });

  it("요원은 최대 3개 · 많이 한 순(동률은 이름순), 모르는 요원은 빠진다", () => {
    const agents: (AgentKey | "unknown")[] = [
      "jett",
      "jett",
      "jett",
      "sova",
      "sova",
      "omen",
      "sage",
      "unknown",
      "unknown",
      "unknown",
    ];
    const r = aggregateRiotMatches(
      agents.map((agent, i) => match({ start: i, agent })),
      ME,
    );
    const thirdByName = [name("omen"), name("sage")].sort((a, b) =>
      a.localeCompare(b),
    )[0];
    expect(r.stats!.matchCount).toBe(10);
    expect(r.topAgents.map((a) => a.agent)).toEqual([
      name("jett"),
      name("sova"),
      thirdByName,
    ]);
    expect(gamesSum(r)).toBeLessThanOrEqual(r.stats!.matchCount);
  });

  it("판이 없으면 stats null · 요원·포지션 빈 배열", () => {
    expect(aggregateRiotMatches([], ME)).toEqual({
      stats: null,
      topAgents: [],
      topPositions: [],
    });
  });

  it("남의 요원은 세지 않는다", () => {
    // 상대(other)는 오멘 — 내 요원 집계에 나오면 안 된다
    const r = aggregateRiotMatches([match({ agent: "jett" })], ME);
    expect(r.topAgents.map((a) => a.agent)).toEqual([name("jett")]);
  });
});
