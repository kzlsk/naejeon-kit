import { buildTeam } from "./generateTeams";
import type { TeamResult } from "./types";

/** 두 팀 점수 합 차이 */
export function scoreDiffOf(result: TeamResult): number {
  return Math.abs(result.teams[0].score - result.teams[1].score);
}

/** 멤버가 속한 팀 번호 (없으면 -1) */
export function teamIndexOf(result: TeamResult, memberId: string): number {
  return result.teams.findIndex((t) =>
    t.players.some((p) => p.member.id === memberId),
  );
}

/**
 * 서로 다른 팀의 두 선수를 맞바꾸고 두 팀을 다시 평가한다 (F5-5).
 * 점수 합 · 추천 포지션 · 포지션 부족이 buildTeam 으로 다시 계산된다.
 * 같은 팀이거나 없는 선수면 그대로 돌려준다.
 */
export function swapPlayers(
  result: TeamResult,
  idA: string,
  idB: string,
): TeamResult {
  const ta = teamIndexOf(result, idA);
  const tb = teamIndexOf(result, idB);
  if (ta === -1 || tb === -1 || ta === tb) return result;

  const members = result.teams.map((t) => t.players.map((p) => p.member));
  const a = members[ta].find((m) => m.id === idA)!;
  const b = members[tb].find((m) => m.id === idB)!;
  members[ta] = members[ta].map((m) => (m.id === idA ? b : m));
  members[tb] = members[tb].map((m) => (m.id === idB ? a : m));

  return { teams: [buildTeam(members[0]), buildTeam(members[1])] };
}

export type SwapState = {
  result: TeamResult;
  /** 첫 번째로 고른 선수 */
  selectedId: string | null;
};

/**
 * 교체 모드에서 선수를 눌렀을 때.
 * - 아무도 안 골랐으면 → 그 선수 선택
 * - 같은 선수를 다시 누르면 → 선택 해제
 * - 같은 팀의 다른 선수 → 선택만 그 사람으로
 * - 다른 팀 선수 → 두 명 교체, 선택 해제
 */
export function pickForSwap(state: SwapState, memberId: string): SwapState {
  const { result, selectedId } = state;
  if (!selectedId) return { result, selectedId: memberId };
  if (selectedId === memberId) return { result, selectedId: null };
  if (teamIndexOf(result, selectedId) === teamIndexOf(result, memberId)) {
    return { result, selectedId: memberId };
  }
  return {
    result: swapPlayers(result, selectedId, memberId),
    selectedId: null,
  };
}
