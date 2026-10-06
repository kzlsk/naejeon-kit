import type { PositionProficiency, Tier } from "@/lib/constants";

/** `members` 테이블 한 행 (PRD §7.1) */
export type Member = {
  id: string;
  nickname: string;
  /** null = 정보 미입력 */
  currentTier: Tier | null;
  peakTier: Tier | null;
  positions: PositionProficiency;
};

export type MemberInput = Omit<Member, "id">;
