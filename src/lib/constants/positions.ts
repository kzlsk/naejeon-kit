/** 게임 내 역할. 방장/참가자 구분(userType)과 혼동하지 않도록 항상 `position`으로 표기. */
export const POSITIONS = [
  "duelist",
  "initiator",
  "controller",
  "sentinel",
] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  duelist: "타격대",
  initiator: "척후대",
  controller: "전략가",
  sentinel: "감시자",
};

export const PROFICIENCIES = ["main", "can", "no"] as const;
export type Proficiency = (typeof PROFICIENCIES)[number];

export const PROFICIENCY_LABELS: Record<Proficiency, string> = {
  main: "주력",
  can: "가능",
  no: "불가",
};

/** 탭할 때마다 can → main → no → can 순환 (PRD F3-2) */
export const NEXT_PROFICIENCY: Record<Proficiency, Proficiency> = {
  can: "main",
  main: "no",
  no: "can",
};

export type PositionProficiency = Record<Position, Proficiency>;

export const DEFAULT_POSITIONS: PositionProficiency = {
  duelist: "can",
  initiator: "can",
  controller: "can",
  sentinel: "can",
};
