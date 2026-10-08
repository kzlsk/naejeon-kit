import {
  NICKNAME_MAX_LENGTH,
  type PositionProficiency,
  type Tier,
} from "@/lib/constants";

import type { RiotProfile } from "./types";

/** 라이엇 정보로 채울 수 있는 폼 값 */
export type RiotFillableForm = {
  nickname: string;
  currentTier: Tier | null;
  peakTier: Tier | null;
  positions: PositionProficiency;
};

/** "철수#KR1" → "철수" */
export function riotGameName(riotId: string): string {
  const hash = riotId.lastIndexOf("#");
  return (hash === -1 ? riotId : riotId.slice(0, hash)).trim();
}

/**
 * 연결 성공 시 폼 자동 채우기.
 * - 닉네임: 비어 있을 때만 Riot ID 의 # 앞부분
 * - 현티: Riot 현재 티어
 * - 최티: 그대로 (공식 API 로 정확히 알 수 없음)
 * - 포지션: topPositions[0] 주력, [1] 가능, 나머지는 기존값
 */
export function applyRiotProfile<F extends RiotFillableForm>(
  form: F,
  profile: RiotProfile,
): F {
  const [first, second] = profile.topPositions;
  const positions = { ...form.positions };
  if (first) positions[first] = "main";
  if (second && second !== first) positions[second] = "can";

  return {
    ...form,
    nickname: form.nickname.trim()
      ? form.nickname
      : riotGameName(profile.riotId).slice(0, NICKNAME_MAX_LENGTH),
    currentTier: profile.currentTier,
    positions,
  };
}
