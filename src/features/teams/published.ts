import type { Member } from "@/features/members/types";

import { buildTeam } from "./generateTeams";
import type { TeamResult } from "./types";

/** 방장이 공유한 팀 구성 — 팀1 / 팀2 멤버 id (rooms.team1_ids / team2_ids, F5-7) */
export type TeamIds = [string[], string[]];

export function teamIdsOf(result: TeamResult): TeamIds {
  return [
    result.teams[0].players.map((p) => p.member.id),
    result.teams[1].players.map((p) => p.member.id),
  ];
}

/** 팀 안 순서는 무시하고, 팀1 / 팀2 구성이 같은지 */
export function sameTeamIds(a: TeamIds, b: TeamIds): boolean {
  const same = (x: string[], y: string[]) =>
    x.length === y.length && x.every((id) => y.includes(id));
  return same(a[0], b[0]) && same(a[1], b[1]);
}

/**
 * 공유된 구성을 멤버 정보로 다시 평가한다 (자동 생성 · 선수 교체와 같은 buildTeam).
 * 멤버가 삭제됐거나 티어가 지워졌으면 null — 방장이 다시 짤 때까지 보여주지 않는다.
 */
export function resolveTeams(
  ids: TeamIds,
  members: readonly Member[],
): TeamResult | null {
  const byId = new Map(members.map((m) => [m.id, m]));
  const pick = (team: string[]) => team.map((id) => byId.get(id));
  const [t1, t2] = [pick(ids[0]), pick(ids[1])];
  const all = [...t1, ...t2];
  if (all.some((m) => !m?.currentTier)) return null;
  return {
    teams: [buildTeam(t1 as Member[]), buildTeam(t2 as Member[])],
  };
}

/**
 * 새로고침한 방장 화면: 공유된 구성이 자동 생성 결과와 같은 10명인데 나눔만 다르면
 * 선수 교체 결과로 복원한다 (F5-6). 같거나 복원할 수 없으면 null.
 */
export function restoreSwap(
  generated: TeamResult | null,
  ids: TeamIds | null,
): TeamResult | null {
  if (!generated || !ids || sameTeamIds(teamIdsOf(generated), ids)) {
    return null;
  }
  const members = generated.teams.flatMap((t) =>
    t.players.map((p) => p.member),
  );
  return resolveTeams(ids, members);
}
