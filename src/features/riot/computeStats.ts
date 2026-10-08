import {
  AGENT_KEY_BY_UUID,
  AGENT_POSITIONS,
  AGENTS,
  POSITIONS,
  type Position,
} from "@/lib/constants";

import type { RiotStats, RiotTopAgent } from "./types";

/**
 * val/match/v1 MatchDto 중 집계에 쓰는 필드만. riotProvider 실제 구현 때
 * 서버에서 받은 매치를 그대로 넘기면 된다 (남는 필드는 무시).
 */
export type RiotMatch = {
  matchInfo: {
    queueId: string;
    gameStartMillis: number;
    /** 액트 ID */
    seasonId: string;
  };
  players: {
    puuid: string;
    teamId: string;
    /** 플레이한 요원 uuid */
    characterId: string;
    stats: { score: number; roundsPlayed: number } | null;
  }[];
  teams: { teamId: string; won: boolean }[] | null;
  roundResults:
    | {
        playerStats: {
          puuid: string;
          damage: {
            headshots: number;
            bodyshots: number;
            legshots: number;
          }[];
        }[];
      }[]
    | null;
};

export const STATS_MAX_MATCHES = 30;
/** 이보다 적으면 지표 대신 "기록이 부족해요" */
export const STATS_MIN_MATCHES = 5;
export const TOP_AGENTS_MAX = 3;
export const TOP_POSITIONS_MAX = 2;

export type AgentInfo = { agent: string; position: Position };
/** characterId → 한글 이름·포지션. 모르는 요원이면 null (집계에서 빠짐) */
export type AgentResolver = (characterId: string) => AgentInfo | null;

/** fetch-assets 가 생성한 요원 표 기준 */
export const resolveAgent: AgentResolver = (characterId) => {
  const key = AGENT_KEY_BY_UUID[characterId.toLowerCase()];
  return key ? { agent: AGENTS[key], position: AGENT_POSITIONS[key] } : null;
};

type AggregateOptions = {
  /** 이번 액트만 집계. 생략하면 액트 구분 없이 */
  seasonId?: string;
  resolveAgent?: AgentResolver;
};

type Player = RiotMatch["players"][number];
type MyMatch = { m: RiotMatch; me: Player };

/**
 * 집계 대상 매치 집합 — 경쟁전 · (주면) 이번 액트 · puuid 가 참가한 판 중 최근 최대 30판.
 * stats·topAgents·topPositions 는 모두 이 집합에서 계산한다.
 */
export function selectRecentMatches(
  matches: readonly RiotMatch[],
  puuid: string,
  { seasonId }: Pick<AggregateOptions, "seasonId"> = {},
): MyMatch[] {
  return matches
    .filter(
      (m) =>
        m.matchInfo.queueId === "competitive" &&
        (seasonId === undefined || m.matchInfo.seasonId === seasonId),
    )
    .map((m) => ({ m, me: m.players.find((p) => p.puuid === puuid) }))
    .filter((x): x is MyMatch => Boolean(x.me))
    .sort(
      (a, b) => b.m.matchInfo.gameStartMillis - a.m.matchInfo.gameStartMillis,
    )
    .slice(0, STATS_MAX_MATCHES);
}

function statsOf(mine: readonly MyMatch[], puuid: string): RiotStats | null {
  if (mine.length === 0) return null;

  let wins = 0;
  let score = 0;
  let rounds = 0;
  let head = 0;
  let body = 0;
  let leg = 0;

  for (const { m, me } of mine) {
    if (m.teams?.find((t) => t.teamId === me.teamId)?.won) wins++;
    score += me.stats?.score ?? 0;
    rounds += me.stats?.roundsPlayed ?? 0;
    for (const round of m.roundResults ?? []) {
      for (const ps of round.playerStats) {
        if (ps.puuid !== puuid) continue;
        for (const d of ps.damage) {
          head += d.headshots;
          body += d.bodyshots;
          leg += d.legshots;
        }
      }
    }
  }

  const shots = head + body + leg;
  return {
    matchCount: mine.length,
    wins,
    winRate: wins / mine.length,
    avgAcs: rounds > 0 ? score / rounds : 0,
    headshotPct: shots > 0 ? head / shots : 0,
    bodyshotPct: shots > 0 ? body / shots : 0,
    legshotPct: shots > 0 ? leg / shots : 0,
  };
}

/**
 * 요원별 판수 → 많이 한 순 최대 3개, 포지션별 판수 → 많이 한 순 최대 2개.
 * 한 판에 요원은 하나라 games 합은 집계한 판 수를 넘지 않는다.
 * 동률이면 요원은 이름순, 포지션은 POSITIONS 순.
 */
export function topAgentsAndPositions(plays: readonly AgentInfo[]): {
  topAgents: RiotTopAgent[];
  topPositions: Position[];
} {
  const byAgent = new Map<string, RiotTopAgent>();
  const byPosition = new Map<Position, number>();
  for (const { agent, position } of plays) {
    const row = byAgent.get(agent) ?? { agent, position, games: 0 };
    row.games++;
    byAgent.set(agent, row);
    byPosition.set(position, (byPosition.get(position) ?? 0) + 1);
  }

  const topAgents = [...byAgent.values()]
    .sort((a, b) => b.games - a.games || a.agent.localeCompare(b.agent))
    .slice(0, TOP_AGENTS_MAX);
  const topPositions = POSITIONS.filter((p) => byPosition.has(p))
    .sort((a, b) => byPosition.get(b)! - byPosition.get(a)!)
    .slice(0, TOP_POSITIONS_MAX);
  return { topAgents, topPositions };
}

export type RiotMatchAggregate = {
  stats: RiotStats | null;
  topAgents: RiotTopAgent[];
  topPositions: Position[];
};

/**
 * 같은 매치 집합(이번 액트 경쟁전 최근 최대 30판)에서 지표·요원·포지션을 한 번에 집계 (순수 함수).
 * 지표를 합친 점수·등급은 만들지 않는다.
 */
export function aggregateRiotMatches(
  matches: readonly RiotMatch[],
  puuid: string,
  { seasonId, resolveAgent: resolve = resolveAgent }: AggregateOptions = {},
): RiotMatchAggregate {
  const mine = selectRecentMatches(matches, puuid, { seasonId });
  const plays = mine.flatMap(({ me }) => resolve(me.characterId) ?? []);
  return { stats: statsOf(mine, puuid), ...topAgentsAndPositions(plays) };
}

/** 지표만 필요할 때. aggregateRiotMatches(...).stats 와 같다 */
export function computeStats(
  matches: readonly RiotMatch[],
  puuid: string,
  options: Pick<AggregateOptions, "seasonId"> = {},
): RiotStats | null {
  return statsOf(selectRecentMatches(matches, puuid, options), puuid);
}
