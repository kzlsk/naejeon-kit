import {
  POSITION_LABELS,
  POSITIONS,
  type PositionProficiency,
} from "@/lib/constants";

/** 포지션을 하나도 안 고른 상태(전부 `can`). 포지션은 선택사항 (F3-2) */
export function isFreePositions(p: PositionProficiency): boolean {
  return POSITIONS.every((pos) => p[pos] === "can");
}

/** 칩 표시용: 주력 → 가능 순 (불가 제외). 선택 안 했으면 빈 배열 */
export function playablePositions(p: PositionProficiency) {
  if (isFreePositions(p)) return [];
  return [
    ...POSITIONS.filter((pos) => p[pos] === "main"),
    ...POSITIONS.filter((pos) => p[pos] === "can"),
  ].map((pos) => ({
    pos,
    label: POSITION_LABELS[pos],
    main: p[pos] === "main",
  }));
}

/**
 * 목록 한 줄 요약. 선택 안 했으면 빈 문자열(공백 표시).
 * 주력이 있으면 주력들, 없으면 "가능" 포지션들. 예: "타격대 · 척후대", "전략가 · 감시자"
 */
export function positionSummary(p: PositionProficiency): string {
  if (isFreePositions(p)) return "";
  const mains = POSITIONS.filter((pos) => p[pos] === "main");
  const shown = mains.length
    ? mains
    : POSITIONS.filter((pos) => p[pos] === "can");
  return shown.map((pos) => POSITION_LABELS[pos]).join(" · ");
}
