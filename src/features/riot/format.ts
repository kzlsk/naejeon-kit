import { STATS_MIN_MATCHES } from "./computeStats";
import type { RiotStats } from "./types";

/** 0~1 → "23%" (소수점 없이) */
export const formatPct = (v: number) => `${Math.round(v * 100)}%`;

/** ACS → 정수 */
export const formatAcs = (v: number) => String(Math.round(v));

/** 승률 50% 기준 은은한 구분만 (등급 뱃지 없음) */
export const winRateClass = (winRate: number) =>
  winRate >= 0.5 ? "text-live" : "text-danger";

/** 지표를 보여줄 만큼 판이 있는지 (5판 미만이면 "기록 부족") */
export function hasEnoughMatches(
  stats: RiotStats | null | undefined,
): stats is RiotStats {
  return !!stats && stats.matchCount >= STATS_MIN_MATCHES;
}
