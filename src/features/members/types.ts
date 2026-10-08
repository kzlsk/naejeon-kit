import type { PositionProficiency, Tier } from "@/lib/constants";

import type { RiotStats, RiotTopAgent } from "@/features/riot/types";

/** `members` 테이블 한 행 (PRD §7.1) */
export type Member = {
  id: string;
  nickname: string;
  /** null = 정보 미입력 */
  currentTier: Tier | null;
  peakTier: Tier | null;
  positions: PositionProficiency;
  /** 라이엇 계정 연결 시 "철수#KR1". 없으면 연결 안 함 */
  riotId?: string | null;
  /** 연결 시 자주 플레이한 요원 (최대 3개) */
  topAgents?: RiotTopAgent[] | null;
  /** 연결 시 이번 액트 전적 지표. 팀 짜기에는 쓰지 않는다 */
  riotStats?: RiotStats | null;
};

export type MemberInput = Omit<Member, "id">;
