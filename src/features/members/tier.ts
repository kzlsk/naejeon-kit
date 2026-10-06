import {
  TIER_GROUPS,
  UNRANKED,
  type RankedTier,
  type Tier,
  type TierGroup,
} from "@/lib/constants";

export type TierGroupOrUnranked = TierGroup | typeof UNRANKED;

export const UNRANKED_LABEL = "언랭";

export function tierGroupOf(tier: Tier): TierGroupOrUnranked {
  if (tier === UNRANKED) return UNRANKED;
  return tier.split("_")[0] as TierGroup;
}

export function tierDivisionOf(tier: Tier): number | null {
  const d = tier.split("_")[1];
  return d ? Number(d) : null;
}

export function makeTier(group: TierGroupOrUnranked, division: number): Tier {
  if (group === UNRANKED) return UNRANKED;
  const g = TIER_GROUPS.find((t) => t.key === group)!;
  return (g.divisions === 1 ? g.key : `${g.key}_${division}`) as RankedTier;
}

export function groupShortLabel(group: TierGroupOrUnranked): string {
  if (group === UNRANKED) return UNRANKED_LABEL;
  return TIER_GROUPS.find((t) => t.key === group)!.short;
}

/** 화면 표시용 짧은 이름. 예: `platinum_1` → "플래 1", `radiant` → "레디언트" */
export function formatTier(tier: Tier): string {
  const label = groupShortLabel(tierGroupOf(tier));
  const division = tierDivisionOf(tier);
  return division ? `${label} ${division}` : label;
}
