import { describe, expect, it } from "vitest";

import {
  DEFAULT_POSITIONS,
  POSITIONS,
  type Position,
  type PositionProficiency,
  type Tier,
} from "@/lib/constants";
import type { Member } from "@/features/members/types";

import { generateTeams, rankTeamOptions } from "./generateTeams";

const member = (
  i: number,
  tier: Tier,
  positions: Partial<PositionProficiency> = {},
): Member => ({
  id: String(i),
  nickname: `m${i}`,
  currentTier: tier,
  peakTier: null,
  positions: { ...DEFAULT_POSITIONS, ...positions },
});

/** 한 포지션만 main, 나머지는 no */
const only = (pos: Position): PositionProficiency =>
  Object.fromEntries(
    POSITIONS.map((p) => [p, p === pos ? "main" : "no"]),
  ) as PositionProficiency;

const ids = (r: { teams: readonly { players: { member: Member }[] }[] }) =>
  r.teams.map((t) =>
    t.players
      .map((p) => p.member.id)
      .sort()
      .join(","),
  );

describe("generateTeams (PRD §6)", () => {
  it("전부 같은 티어 + 포지션 고르게 분포 → missing 0", () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      member(i, "gold_2", only(POSITIONS[i % 4])),
    );
    const r = generateTeams(list);
    expect(r.teams[0].missing).toEqual([]);
    expect(r.teams[1].missing).toEqual([]);
  });

  it("전략가 가능 인원 1명 → 한 팀에만 전략가, 다른 팀 경고", () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      member(i, "gold_2", i === 0 ? {} : { controller: "no" }),
    );
    const r = generateTeams(list);
    const missing = r.teams.map((t) => t.missing);
    expect(missing).toContainEqual(["controller"]);
    expect(missing).toContainEqual([]);
  });

  it("티어 극단 분포 → 점수 합 차이가 최소인 조합", () => {
    const tiers: Tier[] = [
      "radiant",
      "immortal_3",
      "iron_1",
      "iron_1",
      "iron_2",
      "gold_1",
      "gold_1",
      "silver_1",
      "silver_1",
      "bronze_1",
    ];
    const list = tiers.map((t, i) => member(i, t));
    const [best] = rankTeamOptions(list);
    // 가능한 모든 조합 중 최소 점수 차와 같아야 한다
    const all = rankTeamOptions(list, Infinity);
    const minDiff = Math.min(...all.map((o) => o.scoreDiff));
    expect(best.scoreDiff).toBeCloseTo(minDiff);
  });

  it("입력이 10명이 아니거나 티어 미입력이면 에러", () => {
    expect(() => generateTeams([member(1, "gold_1")])).toThrow();
    const list = Array.from({ length: 10 }, (_, i) => member(i, "gold_1"));
    list[3] = { ...list[3], currentTier: null };
    expect(() => generateTeams(list)).toThrow("티어 미입력");
  });

  it("다시 짜기용 상위 조합은 서로 다른 팀 구성이고 비용 순이다", () => {
    const tiers: Tier[] = [
      "gold_1",
      "gold_2",
      "gold_3",
      "silver_1",
      "silver_2",
      "platinum_1",
      "platinum_2",
      "bronze_3",
      "diamond_1",
      "iron_3",
    ];
    const options = rankTeamOptions(tiers.map((t, i) => member(i, t)));
    expect(options).toHaveLength(10);
    const splits = options.map((o) => ids(o).sort().join("|"));
    expect(new Set(splits).size).toBe(10);
    for (let i = 1; i < options.length; i++) {
      expect(options[i].cost).toBeGreaterThanOrEqual(options[i - 1].cost);
    }
  });

  it("flex 멤버의 추천 포지션은 본인 main", () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      member(i, "gold_2", only(POSITIONS[i % 4])),
    );
    for (const team of generateTeams(list).teams) {
      const flex = team.players.find((p) => p.slot === "flex")!;
      expect(flex.member.positions[flex.recommended!]).toBe("main");
    }
  });

  it("50ms 이내", () => {
    const list = Array.from({ length: 10 }, (_, i) => member(i, "gold_2"));
    const start = performance.now();
    rankTeamOptions(list);
    expect(performance.now() - start).toBeLessThan(50);
  });
});

describe("playerPositionLabel", () => {
  it("역할을 안 고른 멤버는 배정 칸과 상관없이 공백", async () => {
    const { playerPositionLabel } = await import("./format");
    const list = Array.from({ length: 10 }, (_, i) =>
      member(i, "gold_2", i < 2 ? { duelist: "main" } : {}),
    );
    for (const team of generateTeams(list).teams) {
      for (const p of team.players) {
        const free = Number(p.member.id) >= 2;
        if (free) expect(playerPositionLabel(p)).toBe("");
        else expect(playerPositionLabel(p)).not.toBe("");
      }
    }
  });
});

describe("라이엇 전적 지표", () => {
  it("팀 짜기 결과에 영향을 주지 않는다", () => {
    const tiers: Tier[] = [
      "gold_1",
      "gold_2",
      "silver_3",
      "platinum_1",
      "diamond_1",
      "bronze_2",
      "gold_3",
      "silver_1",
      "platinum_2",
      "ascendant_1",
    ];
    const plain = tiers.map((t, i) => member(i, t));
    const withStats = plain.map((m, i) => ({
      ...m,
      riotId: `m${i}#KR1`,
      // 티어와 반대로 지표를 몰아줘도 결과가 같아야 한다
      riotStats: {
        matchCount: 30,
        wins: i % 2 ? 27 : 3,
        winRate: i % 2 ? 0.9 : 0.1,
        avgAcs: i % 2 ? 400 : 50,
        headshotPct: 0.5,
        bodyshotPct: 0.5,
        legshotPct: 0,
      },
    }));
    const ids = (r: ReturnType<typeof generateTeams>) =>
      r.teams.map((t) => t.players.map((p) => p.member.id));
    expect(ids(generateTeams(withStats))).toEqual(ids(generateTeams(plain)));
    expect(rankTeamOptions(withStats, 5).map(ids)).toEqual(
      rankTeamOptions(plain, 5).map(ids),
    );
  });
});
