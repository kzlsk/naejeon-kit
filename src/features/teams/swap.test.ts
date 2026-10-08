import { describe, expect, it } from "vitest";

import { DEMO_MEMBERS } from "@/lib/dev/fixtures";
import type { Member } from "@/features/members/types";

import { buildTeam, generateTeams } from "./generateTeams";
import { memberScore } from "./score";
import { pickForSwap, scoreDiffOf, swapPlayers, teamIndexOf } from "./swap";
import type { TeamResult } from "./types";

/** 10명 모두 티어 입력된 멤버 */
const MEMBERS: Member[] = DEMO_MEMBERS.map((m) =>
  m.currentTier ? m : { ...m, currentTier: "silver_2" },
);

const ids = (r: TeamResult, i: 0 | 1) =>
  r.teams[i].players.map((p) => p.member.id).sort();

const sumScore = (team: TeamResult["teams"][number]) =>
  team.players.reduce(
    (s, p) => s + memberScore(p.member.currentTier, p.member.peakTier)!,
    0,
  );

describe("swapPlayers", () => {
  const base = generateTeams(MEMBERS);
  const a = base.teams[0].players[0].member.id;
  const b = base.teams[1].players[0].member.id;

  it("다른 팀 두 명의 소속을 맞바꾼다", () => {
    const r = swapPlayers(base, a, b);
    expect(teamIndexOf(r, a)).toBe(1);
    expect(teamIndexOf(r, b)).toBe(0);
    expect(r.teams[0].players).toHaveLength(5);
    expect(r.teams[1].players).toHaveLength(5);
  });

  it("점수 합·포지션 배정·부족 포지션을 다시 계산한다 (buildTeam 과 같음)", () => {
    const r = swapPlayers(base, a, b);
    for (const i of [0, 1] as const) {
      expect(r.teams[i].score).toBeCloseTo(sumScore(r.teams[i]));
      const members = r.teams[i].players.map((p) => p.member);
      expect(r.teams[i]).toEqual(buildTeam(members));
    }
    expect(scoreDiffOf(r)).toBeCloseTo(
      Math.abs(r.teams[0].score - r.teams[1].score),
    );
  });

  it("같은 팀이거나 없는 선수면 그대로", () => {
    const sameTeam = base.teams[0].players[1].member.id;
    expect(swapPlayers(base, a, sameTeam)).toBe(base);
    expect(swapPlayers(base, a, "nope")).toBe(base);
  });

  it("두 번 바꾸면 원래 팀 구성", () => {
    const back = swapPlayers(swapPlayers(base, a, b), a, b);
    expect(ids(back, 0)).toEqual(ids(base, 0));
    expect(ids(back, 1)).toEqual(ids(base, 1));
  });
});

describe("pickForSwap — 선택 규칙", () => {
  const base = generateTeams(MEMBERS);
  const [a1, a2] = base.teams[0].players.map((p) => p.member.id);
  const [b1] = base.teams[1].players.map((p) => p.member.id);
  const start = { result: base, selectedId: null };

  it("첫 선택", () => {
    expect(pickForSwap(start, a1)).toEqual({ result: base, selectedId: a1 });
  });

  it("같은 사람 다시 누르면 선택 해제", () => {
    expect(pickForSwap({ result: base, selectedId: a1 }, a1)).toEqual({
      result: base,
      selectedId: null,
    });
  });

  it("같은 팀 다른 선수 → 선택만 바뀜", () => {
    expect(pickForSwap({ result: base, selectedId: a1 }, a2)).toEqual({
      result: base,
      selectedId: a2,
    });
  });

  it("다른 팀 선수 → 교체 후 선택 해제, 연속 교체 가능", () => {
    const once = pickForSwap({ result: base, selectedId: a1 }, b1);
    expect(once.selectedId).toBeNull();
    expect(teamIndexOf(once.result, a1)).toBe(1);

    const again = pickForSwap(pickForSwap(once, a2), a1);
    expect(teamIndexOf(again.result, a2)).toBe(1);
    expect(teamIndexOf(again.result, a1)).toBe(0);
  });
});
