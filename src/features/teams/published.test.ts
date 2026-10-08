import { describe, expect, it } from "vitest";

import { DEMO_MEMBERS } from "@/lib/dev/fixtures";
import type { Member } from "@/features/members/types";

import { generateTeams } from "./generateTeams";
import {
  resolveTeams,
  restoreSwap,
  sameTeamIds,
  teamIdsOf,
  type TeamIds,
} from "./published";
import { swapPlayers } from "./swap";

/** 10명 모두 티어 입력된 멤버 */
const MEMBERS: Member[] = DEMO_MEMBERS.map((m) =>
  m.currentTier ? m : { ...m, currentTier: "silver_2" },
);

describe("published teams", () => {
  const result = generateTeams(MEMBERS);
  const ids = teamIdsOf(result);

  it("teamIdsOf → resolveTeams 하면 같은 결과", () => {
    expect(resolveTeams(ids, MEMBERS)?.teams).toEqual(result.teams);
  });

  it("교체된 구성도 buildTeam 으로 다시 평가", () => {
    const a = result.teams[0].players[0].member.id;
    const b = result.teams[1].players[0].member.id;
    const swapped = swapPlayers(result, a, b);
    expect(resolveTeams(teamIdsOf(swapped), MEMBERS)).toEqual(swapped);
  });

  it("멤버 정보가 바뀌면 바뀐 정보로 평가", () => {
    const id = ids[0][0];
    const renamed = MEMBERS.map((m) =>
      m.id === id ? { ...m, nickname: "새이름" } : m,
    );
    const resolved = resolveTeams(ids, renamed)!;
    expect(
      resolved.teams[0].players.some((p) => p.member.nickname === "새이름"),
    ).toBe(true);
  });

  it("삭제된 멤버나 티어 미입력 멤버가 있으면 null", () => {
    expect(
      resolveTeams(
        ids,
        MEMBERS.filter((m) => m.id !== ids[1][2]),
      ),
    ).toBeNull();
    expect(
      resolveTeams(
        ids,
        MEMBERS.map((m) =>
          m.id === ids[0][1] ? { ...m, currentTier: null } : m,
        ),
      ),
    ).toBeNull();
  });

  it("sameTeamIds: 팀 안 순서는 무시, 팀1/팀2 가 바뀌면 다름", () => {
    const reordered: TeamIds = [[...ids[0]].reverse(), [...ids[1]].reverse()];
    expect(sameTeamIds(ids, reordered)).toBe(true);
    expect(sameTeamIds(ids, [ids[1], ids[0]])).toBe(false);
    const swapped: TeamIds = [
      [ids[1][0], ...ids[0].slice(1)],
      [ids[0][0], ...ids[1].slice(1)],
    ];
    expect(sameTeamIds(ids, swapped)).toBe(false);
  });

  it("restoreSwap: 같은 10명을 다르게 나눴을 때만 교체 결과로", () => {
    const a = ids[0][0];
    const b = ids[1][0];
    const swapped = swapPlayers(result, a, b);
    expect(restoreSwap(result, teamIdsOf(swapped))).toEqual(swapped);
    expect(restoreSwap(result, ids)).toBeNull();
    expect(restoreSwap(result, null)).toBeNull();
    expect(restoreSwap(null, ids)).toBeNull();
    expect(restoreSwap(result, [["x", ...ids[0].slice(1)], ids[1]])).toBeNull();
  });
});
