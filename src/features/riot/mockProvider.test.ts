import { describe, expect, it } from "vitest";

import { POSITIONS, TIER_SCORES, UNRANKED } from "@/lib/constants";

import {
  createMockProvider,
  mockAggregate,
  MOCK_PROFILES,
  mockStats,
} from "./mockProvider";
import { RiotConnectError, type RiotProfile } from "./types";

const noSleep = async () => {};
/** 순서대로 값을 돌려주는 random */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const TIERS = [...Object.keys(TIER_SCORES), UNRANKED];

function expectRiotProfile(p: RiotProfile) {
  expect(Object.keys(p).sort()).toEqual(
    [
      "currentTier",
      "fetchedAt",
      "riotId",
      "stats",
      "topAgents",
      "topPositions",
    ].sort(),
  );
  expect(p.riotId).toMatch(/^[^#]{1,16}#[^#]{1,5}$/);
  expect(TIERS).toContain(p.currentTier);
  expect(p.topAgents.length).toBeLessThanOrEqual(3);
  for (const a of p.topAgents) {
    expect(Object.keys(a).sort()).toEqual(["agent", "games", "position"]);
    expect(typeof a.agent).toBe("string");
    expect(POSITIONS).toContain(a.position);
    expect(Number.isInteger(a.games)).toBe(true);
  }
  expect(p.topPositions.length).toBeLessThanOrEqual(2);
  for (const pos of p.topPositions) expect(POSITIONS).toContain(pos);
  expect(new Date(p.fetchedAt).toISOString()).toBe(p.fetchedAt);
}

describe("mockProvider", () => {
  it("모든 가짜 프로필이 RiotProfile 형태다", async () => {
    for (let i = 0; i < MOCK_PROFILES.length; i++) {
      const provider = createMockProvider({
        sleep: noSleep,
        // 지연, 실패 판정(통과), 프로필 선택, 판 수(21판)
        random: seq(0, 0.5, (i + 0.5) / MOCK_PROFILES.length, 0.7),
      });
      const p = await provider.connect("ABC123");
      expect(p.riotId).toBe(MOCK_PROFILES[i].riotId);
      expect(p.stats?.matchCount).toBe(21);
      expect(p.topAgents.length).toBeGreaterThan(0);
      expectRiotProfile(p);
    }
  });

  it("가짜 프로필은 브론즈~다이아 범위", () => {
    for (const p of MOCK_PROFILES) {
      expect(p.currentTier).toMatch(/^(bronze|silver|gold|platinum|diamond)_/);
    }
  });

  it("800~1500ms 지연한다", async () => {
    const delays: number[] = [];
    const sleep = async (ms: number) => void delays.push(ms);
    await createMockProvider({ sleep, random: seq(0, 0.5, 0) }).connect("A");
    await createMockProvider({ sleep, random: seq(0.999, 0.5, 0) }).connect(
      "A",
    );
    expect(delays[0]).toBe(800);
    expect(delays[1]).toBeGreaterThan(1499);
    expect(delays[1]).toBeLessThanOrEqual(1500);
  });

  it("10% 확률로 취소/실패 에러", async () => {
    const connect = (roll: number) =>
      createMockProvider({ sleep: noSleep, random: seq(0, roll, 0) }).connect(
        "A",
      );
    await expect(connect(0.01)).rejects.toMatchObject({ code: "cancelled" });
    await expect(connect(0.09)).rejects.toBeInstanceOf(RiotConnectError);
    await expect(connect(0.09)).rejects.toMatchObject({ code: "failed" });
    await expect(connect(0.1)).resolves.toBeDefined();
  });

  it("돌려준 값을 고쳐도 원본 목록은 그대로", async () => {
    const provider = createMockProvider({
      sleep: noSleep,
      random: seq(0, 0.5, 0),
    });
    const p = await provider.connect("A");
    p.riotId = "바꿈#0000";
    expect(MOCK_PROFILES[0].riotId).toBe("철수#KR1");
  });
});

describe("mockAggregate — 판 수 안에서 요원 판수를 나눈다", () => {
  /** 첫 random 으로 matchCount = n 이 되게, 나머지는 0.5 */
  const withCount = (n: number) => {
    let first = true;
    return () => {
      if (!first) return 0.5;
      first = false;
      return (n + 0.5) / 31;
    };
  };
  const gamesSum = (r: ReturnType<typeof mockAggregate>) =>
    r.topAgents.reduce((s, a) => s + a.games, 0);

  it.each(MOCK_PROFILES.map((p) => [p.riotId, p] as const))(
    "%s: 0~30판 모두에서 topAgents games 합 ≤ matchCount",
    (_, profile) => {
      for (let n = 0; n <= 30; n++) {
        const r = mockAggregate(profile, withCount(n));
        expect(r.stats?.matchCount ?? 0).toBe(n);
        expect(gamesSum(r)).toBeLessThanOrEqual(n);
        expect(r.topAgents.length).toBeLessThanOrEqual(3);
        expect(r.topPositions.length).toBeLessThanOrEqual(2);
        for (const a of r.topAgents) expect(a.games).toBeGreaterThan(0);
        // 포지션은 같은 판 집합에서 집계된 요원에서만 나온다
        for (const pos of r.topPositions) {
          expect(r.topAgents.some((a) => a.position === pos)).toBe(true);
        }
      }
    },
  );

  it("0판이면 stats null · 요원·포지션 없음", () => {
    expect(mockAggregate(MOCK_PROFILES[0], withCount(0))).toEqual({
      stats: null,
      topAgents: [],
      topPositions: [],
    });
  });

  it("가짜 프로필의 share 합은 1 이하", () => {
    for (const p of MOCK_PROFILES) {
      expect(p.agents.reduce((s, a) => s + a.share, 0)).toBeLessThanOrEqual(1);
    }
  });

  it("connect 결과도 games 합 ≤ matchCount (실제 랜덤으로 여러 번)", async () => {
    const provider = createMockProvider({ sleep: noSleep });
    for (let i = 0; i < 100; i++) {
      const p = await provider.connect("A").catch(() => null);
      if (!p) continue;
      const games = p.topAgents.reduce((s, a) => s + a.games, 0);
      expect(games).toBeLessThanOrEqual(p.stats?.matchCount ?? 0);
    }
  });
});

describe("mockStats", () => {
  it("matchCount 0 이면 null", () => {
    expect(mockStats(() => 0.5, 0)).toBeNull();
  });

  it("범위 안의 값, 명중 부위 합은 1", () => {
    for (const [r, n] of [
      [0.05, 1],
      [0.25, 7],
      [0.5, 15],
      [0.75, 23],
      [0.999, 30],
    ]) {
      const s = mockStats(() => r, n)!;
      expect(s.matchCount).toBe(n);
      expect(Number.isInteger(s.matchCount)).toBe(true);
      expect(s.matchCount).toBeGreaterThanOrEqual(0);
      expect(s.matchCount).toBeLessThanOrEqual(30);
      // 판 수에 맞춰 반올림하므로 반 판만큼 범위를 벗어날 수 있다
      const slack = 0.5 / s.matchCount;
      expect(Number.isInteger(s.wins)).toBe(true);
      expect(s.wins).toBeGreaterThanOrEqual(0);
      expect(s.wins).toBeLessThanOrEqual(s.matchCount);
      expect(s.winRate).toBe(s.wins / s.matchCount);
      expect(s.winRate).toBeGreaterThanOrEqual(0.35 - slack);
      expect(s.winRate).toBeLessThanOrEqual(0.65 + slack);
      expect(s.avgAcs).toBeGreaterThanOrEqual(120);
      expect(s.avgAcs).toBeLessThanOrEqual(280);
      expect(s.headshotPct).toBeGreaterThanOrEqual(0.12);
      expect(s.headshotPct).toBeLessThanOrEqual(0.35);
      expect(s.legshotPct).toBeGreaterThanOrEqual(0.02);
      expect(s.legshotPct).toBeLessThanOrEqual(0.1);
      expect(s.headshotPct + s.bodyshotPct + s.legshotPct).toBeCloseTo(1);
    }
  });

  it("판 수는 mockAggregate 가 정하고 최대 30판", () => {
    const r = mockAggregate(MOCK_PROFILES[0], () => 0.9999);
    expect(r.stats!.matchCount).toBe(30);
  });
});
