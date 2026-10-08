import type { Position, Tier } from "@/lib/constants";

/** 자주 플레이한 요원 한 줄. `members.top_agents` jsonb 원소와 같은 형태 */
export type RiotTopAgent = {
  /** 한글 요원 이름 (예: "제트"). 이미지 없이 이름 문자열만 */
  agent: string;
  position: Position;
  games: number;
};

/**
 * 이번 액트 경쟁전 전적 지표 (`members.riot_stats` jsonb 와 같은 형태).
 * 지표를 합친 점수·등급·순위는 만들지 않고, 팀 짜기에도 쓰지 않는다 (라이엇 정책: MMR/ELO 금지).
 */
export type RiotStats = {
  /** 집계한 판 수 (최대 30) */
  matchCount: number;
  /** 0 ≤ wins ≤ matchCount. 나머지는 패(무승부 포함) */
  wins: number;
  /** wins ÷ matchCount, 0~1 */
  winRate: number;
  /** 총 score ÷ 총 roundsPlayed */
  avgAcs: number;
  /** headshots ÷ (head + body + leg), 0~1 */
  headshotPct: number;
  bodyshotPct: number;
  legshotPct: number;
};

/**
 * RiotStats 키 목록 — DB `_validate_riot_stats` 의 키 목록과 같아야 한다.
 * 필드를 바꾸면 새 마이그레이션으로 검증 함수도 바꿀 것 (supabase/tests/rpc.test.ts 가 비교)
 */
export const RIOT_STATS_KEYS = [
  "matchCount",
  "wins",
  "winRate",
  "avgAcs",
  "headshotPct",
  "bodyshotPct",
  "legshotPct",
] as const satisfies readonly (keyof RiotStats)[];

/** 라이엇 계정 연결로 불러오는 정보. MMR 같은 합산 실력 점수는 담지 않는다 */
export type RiotProfile = {
  /** "철수#KR1" */
  riotId: string;
  currentTier: Tier;
  /** 최대 3개, 판수 많은 순 */
  topAgents: RiotTopAgent[];
  /** 플레이 비중 높은 순, 최대 2개 */
  topPositions: Position[];
  /** 집계한 판이 없으면 null */
  stats: RiotStats | null;
  /** ISO */
  fetchedAt: string;
};

/** members 에 저장되는 연결 정보 (Riot 티어·포지션은 폼 값으로 들어가므로 따로 저장 안 함) */
export type RiotLink = {
  riotId: string;
  topAgents: RiotTopAgent[];
  stats: RiotStats | null;
};

export type RiotConnectErrorCode = "cancelled" | "failed" | "not_available";

export class RiotConnectError extends Error {
  constructor(
    readonly code: RiotConnectErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "RiotConnectError";
  }
}
