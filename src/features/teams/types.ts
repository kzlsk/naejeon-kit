import type { Position, Proficiency } from "@/lib/constants";

import type { Member } from "@/features/members/types";

export type TeamPlayer = {
  member: Member;
  score: number;
  /** 배정된 칸. `flex` = 5번째 자유 칸 */
  slot: Position | "flex";
  /** flex면 본인 main 중 하나(없으면 can 중 하나), 아니면 slot과 같음 */
  recommended: Position | null;
  /** slot 포지션에 대한 숙련도 (flex면 null) */
  proficiency: Proficiency | null;
};

export type Team = {
  players: TeamPlayer[];
  score: number;
  /** 채울 수 없는 포지션 (경고 표시용, F5-3) */
  missing: Position[];
};

/** `generateTeams` 결과 (PRD §6.4) */
export type TeamResult = { teams: [Team, Team] };
