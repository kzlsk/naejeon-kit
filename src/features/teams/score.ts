import {
  CURRENT_TIER_WEIGHT,
  PEAK_TIER_WEIGHT,
  TIER_SCORES,
  UNRANKED,
  type RankedTier,
  type Tier,
} from "@/lib/constants";

const tierScore = (t: Tier | null) =>
  t && t !== UNRANKED ? TIER_SCORES[t as RankedTier] : null;

/** 개인 점수 (PRD §6.2). 현티 미입력이면 null */
export function memberScore(
  current: Tier | null,
  peak: Tier | null,
): number | null {
  if (!current) return null;
  const peakScore = tierScore(peak);
  if (current === UNRANKED) return peakScore;
  const cur = tierScore(current)!;
  return cur * CURRENT_TIER_WEIGHT + (peakScore ?? cur) * PEAK_TIER_WEIGHT;
}
