import { PLAYERS_PER_MATCH } from "@/lib/constants";

import type { Member } from "@/features/members/types";

export type TeamReadiness =
  { ready: true } | { ready: false; message: string; missingTier: Member[] };

/** 팀 짜기 가능 여부 — 멤버 정확히 10명 + 전원 현티 입력 (F4-2, F4-3) */
export function teamReadiness(members: Member[]): TeamReadiness {
  const missingTier = members.filter((m) => !m.currentTier);
  if (members.length !== PLAYERS_PER_MATCH) {
    return {
      ready: false,
      message: `멤버가 ${PLAYERS_PER_MATCH}명이어야 해요 (현재 ${members.length}명)`,
      missingTier,
    };
  }
  if (missingTier.length) {
    return {
      ready: false,
      message: `${missingTier.map((m) => m.nickname).join(", ")} 티어 미입력`,
      missingTier,
    };
  }
  return { ready: true };
}
