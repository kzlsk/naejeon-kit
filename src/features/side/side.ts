export type Side = "attack" | "defense";

export const SIDE_LABELS: Record<Side, string> = {
  attack: "공격",
  defense: "수비",
};

export function otherSide(side: Side): Side {
  return side === "attack" ? "defense" : "attack";
}

/** "팀1 공격 / 팀2 수비 시작" (F7-2) */
export function formatSide(team1: Side): string {
  return `팀1 ${SIDE_LABELS[team1]} / 팀2 ${SIDE_LABELS[otherSide(team1)]} 시작`;
}
