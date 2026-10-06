import { POSITION_LABELS } from "@/lib/constants";

import { isFreePositions } from "@/features/members/positionSummary";

import type { Team, TeamPlayer } from "./types";

export const TEAM_NAMES = ["팀1", "팀2"] as const;

export function formatScore(score: number): string {
  return score.toFixed(1);
}

/**
 * 추천 포지션 표시. 예: "타격대 · 주력", "전략가 · 불가", "자유".
 * 역할을 하나도 안 고른 멤버는 배정된 칸과 상관없이 공백 (F3-2)
 */
export function playerPositionLabel(p: TeamPlayer): string {
  if (isFreePositions(p.member.positions)) return "";
  if (p.slot === "flex") return "자유";
  const label = POSITION_LABELS[p.slot];
  if (p.proficiency === "main") return `${label} · 주력`;
  if (p.proficiency === "no") return `${label} · 불가`;
  return label;
}

/** 예: "팀2: 전략가 가능 인원 없음" */
export function teamWarnings(teams: readonly Team[]): string[] {
  return teams.flatMap((t, i) =>
    t.missing.map(
      (pos) => `${TEAM_NAMES[i]}: ${POSITION_LABELS[pos]} 가능 인원 없음`,
    ),
  );
}
