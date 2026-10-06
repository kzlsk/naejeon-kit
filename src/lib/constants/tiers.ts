/** 티어 그룹 (낮은 순). 레디언트는 단계가 없다. */
export const TIER_GROUPS = [
  { key: "iron", label: "아이언", divisions: 3 },
  { key: "bronze", label: "브론즈", divisions: 3 },
  { key: "silver", label: "실버", divisions: 3 },
  { key: "gold", label: "골드", divisions: 3 },
  { key: "platinum", label: "플래티넘", divisions: 3 },
  { key: "diamond", label: "다이아몬드", divisions: 3 },
  { key: "ascendant", label: "초월", divisions: 3 },
  { key: "immortal", label: "불멸", divisions: 3 },
  { key: "radiant", label: "레디언트", divisions: 1 },
] as const;

export type TierGroup = (typeof TIER_GROUPS)[number]["key"];

/** DB 저장값. 예: `gold_2`, `radiant`, `unranked` (PRD §6.1, §7.1) */
// prettier-ignore
export const TIER_SCORES = {
  iron_1: 1, iron_2: 2, iron_3: 3,
  bronze_1: 4, bronze_2: 5, bronze_3: 6,
  silver_1: 7, silver_2: 8, silver_3: 9,
  gold_1: 10, gold_2: 11, gold_3: 12,
  platinum_1: 13, platinum_2: 14, platinum_3: 15,
  diamond_1: 16.5, diamond_2: 18, diamond_3: 19.5,
  ascendant_1: 21, ascendant_2: 22.5, ascendant_3: 24,
  immortal_1: 26, immortal_2: 28, immortal_3: 30,
  radiant: 33,
} as const;

export type RankedTier = keyof typeof TIER_SCORES;
export const UNRANKED = "unranked";
export type Tier = RankedTier | typeof UNRANKED;

/** 개인 점수 가중치 (PRD §6.2) */
export const CURRENT_TIER_WEIGHT = 0.6;
export const PEAK_TIER_WEIGHT = 0.4;
