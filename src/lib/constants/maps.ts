export const MAPS = {
  abyss: "어비스",
  ascent: "어센트",
  bind: "바인드",
  breeze: "브리즈",
  corrode: "코로드",
  fracture: "프랙처",
  haven: "헤이븐",
  icebox: "아이스박스",
  lotus: "로터스",
  pearl: "펄",
  split: "스플릿",
  summit: "서밋",
  sunset: "선셋",
} as const;

export type MapKey = keyof typeof MAPS;

/** 경쟁전 맵 풀 — 2026 Act 5 기준 (Breeze 제외, Abyss 복귀). 액트마다 갱신 필요. */
export const DEFAULT_MAP_POOL: MapKey[] = [
  "abyss",
  "ascent",
  "haven",
  "lotus",
  "split",
  "summit",
  "sunset",
];
