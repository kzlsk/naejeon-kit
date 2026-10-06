import type { MapKey } from "@/lib/constants";

export const MAX_BANS = 2;

/** 탭 토글: 이미 밴이면 해제, 아니면 추가 (2개 찼으면 무시) — PRD §12 */
export function toggleBan(bans: MapKey[], map: MapKey): MapKey[] {
  if (bans.includes(map)) return bans.filter((m) => m !== map);
  if (bans.length >= MAX_BANS) return bans;
  return [...bans, map];
}

/** 맵 풀에서 꺼진 맵은 밴 선택에서도 해제 */
export function pruneBans(bans: MapKey[], pool: MapKey[]): MapKey[] {
  return bans.filter((m) => pool.includes(m));
}

export function remainingMaps(pool: MapKey[], bans: MapKey[]): MapKey[] {
  return pool.filter((m) => !bans.includes(m));
}
