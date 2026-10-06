import {
  ControllerIcon,
  DuelistIcon,
  InitiatorIcon,
  SentinelIcon,
} from "@/components/ui/icons";
import {
  POSITION_LABELS,
  POSITIONS,
  type Position,
  type PositionProficiency,
} from "@/lib/constants";

export const POSITION_ICONS: Record<Position, typeof DuelistIcon> = {
  duelist: DuelistIcon,
  initiator: InitiatorIcon,
  controller: ControllerIcon,
  sentinel: SentinelIcon,
};

/** 주력 → 가능 순으로 정렬한 포지션 (불가 제외). 칩 표시용. */
export function playablePositions(p: PositionProficiency) {
  return [
    ...POSITIONS.filter((pos) => p[pos] === "main"),
    ...POSITIONS.filter((pos) => p[pos] === "can"),
  ].map((pos) => ({
    pos,
    label: POSITION_LABELS[pos],
    main: p[pos] === "main",
  }));
}

/** 목록 한 줄 요약: 주력 포지션들, 없으면 null */
export function mainPositionsLabel(p: PositionProficiency): string | null {
  const mains = POSITIONS.filter((pos) => p[pos] === "main");
  return mains.length
    ? mains.map((pos) => POSITION_LABELS[pos]).join(" · ")
    : null;
}
