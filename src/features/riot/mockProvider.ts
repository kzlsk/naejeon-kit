import type { Position, Tier } from "@/lib/constants";

import {
  STATS_MAX_MATCHES,
  topAgentsAndPositions,
  type AgentInfo,
  type RiotMatchAggregate,
} from "./computeStats";
import type { RiotProfileProvider } from "./provider";
import { RiotConnectError, type RiotStats } from "./types";

/**
 * 가짜 계정. agents 의 share 는 이번 액트 판 중 그 요원을 한 비율 (합 ≤ 1, 나머지는 다른 요원).
 * 판수는 연결할 때 정한 matchCount 안에서 나눈다.
 */
export type MockProfile = {
  riotId: string;
  currentTier: Tier;
  agents: { agent: string; position: Position; share: number }[];
};

/** 가짜 프로필 — 브론즈~다이아. 실제 라이엇 데이터·이미지 없이 이름 문자열만 */
export const MOCK_PROFILES: readonly MockProfile[] = [
  {
    riotId: "철수#KR1",
    currentTier: "gold_2",
    agents: [
      { agent: "제트", position: "duelist", share: 0.45 },
      { agent: "레이즈", position: "duelist", share: 0.3 },
      { agent: "소바", position: "initiator", share: 0.15 },
    ],
  },
  {
    riotId: "영희#0412",
    currentTier: "platinum_1",
    agents: [
      { agent: "오멘", position: "controller", share: 0.5 },
      { agent: "브림스톤", position: "controller", share: 0.25 },
      { agent: "킬조이", position: "sentinel", share: 0.15 },
    ],
  },
  {
    riotId: "민수#KR2",
    currentTier: "bronze_3",
    agents: [
      { agent: "세이지", position: "sentinel", share: 0.45 },
      { agent: "피닉스", position: "duelist", share: 0.3 },
      { agent: "스카이", position: "initiator", share: 0.15 },
    ],
  },
  {
    riotId: "지훈#7777",
    currentTier: "diamond_1",
    agents: [
      { agent: "소바", position: "initiator", share: 0.55 },
      { agent: "페이드", position: "initiator", share: 0.25 },
      { agent: "바이퍼", position: "controller", share: 0.15 },
    ],
  },
  {
    riotId: "다은#KR1",
    currentTier: "silver_2",
    agents: [
      { agent: "킬조이", position: "sentinel", share: 0.5 },
      { agent: "사이퍼", position: "sentinel", share: 0.3 },
      { agent: "오멘", position: "controller", share: 0.1 },
    ],
  },
  {
    riotId: "현우#9090",
    currentTier: "gold_3",
    agents: [
      { agent: "레이나", position: "duelist", share: 0.6 },
      { agent: "브리치", position: "initiator", share: 0.35 },
    ],
  },
];

const FAILURE_RATE = 0.1;
const MIN_DELAY_MS = 800;
const MAX_DELAY_MS = 1500;

type MockOptions = {
  /** [0, 1) — 테스트에서 고정값 주입용 */
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

/** min~max 사이 값 */
const between = (random: () => number, min: number, max: number) =>
  min + random() * (max - min);

/**
 * matchCount 판에 대한 그럴듯한 가짜 지표 (0 이면 null).
 * 승률 0.35~0.65 (wins 는 판 수에 맞춰 반올림, winRate = wins ÷ matchCount), ACS 120~280, 헤드 0.12~0.35, 레그 0.02~0.10, 바디는 나머지
 */
export function mockStats(
  random: () => number,
  matchCount: number,
): RiotStats | null {
  if (matchCount === 0) return null;
  const headshotPct = between(random, 0.12, 0.35);
  const legshotPct = between(random, 0.02, 0.1);
  const wins = Math.round(between(random, 0.35, 0.65) * matchCount);
  return {
    matchCount,
    wins,
    winRate: wins / matchCount,
    avgAcs: between(random, 120, 280),
    headshotPct,
    bodyshotPct: 1 - headshotPct - legshotPct,
    legshotPct,
  };
}

/**
 * 판 수를 먼저 정하고(0~30) 그 안에서 요원별 판수를 나눈 뒤,
 * 실제 집계와 같은 topAgentsAndPositions 로 요원·포지션을 뽑는다.
 * → topAgents 의 games 합 ≤ stats.matchCount 가 항상 성립
 */
export function mockAggregate(
  profile: MockProfile,
  random: () => number,
): RiotMatchAggregate {
  const matchCount = Math.floor(random() * (STATS_MAX_MATCHES + 1));
  const plays: AgentInfo[] = profile.agents.flatMap(
    ({ agent, position, share }) =>
      Array.from({ length: Math.floor(matchCount * share) }, () => ({
        agent,
        position,
      })),
  );
  return {
    stats: mockStats(random, matchCount),
    ...topAgentsAndPositions(plays),
  };
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 승인 전 개발용 가짜 구현. 800~1500ms 뒤 MOCK_PROFILES 중 하나,
 * 10% 확률로 취소/실패 에러 (에러 UI 확인용).
 * 표시용 데모 데이터라 클라이언트 랜덤을 쓴다 (게임 결과 랜덤이 아님).
 */
export function createMockProvider({
  random = Math.random,
  sleep = defaultSleep,
}: MockOptions = {}): RiotProfileProvider {
  return {
    async connect() {
      await sleep(MIN_DELAY_MS + random() * (MAX_DELAY_MS - MIN_DELAY_MS));

      const roll = random();
      if (roll < FAILURE_RATE) {
        throw new RiotConnectError(
          roll < FAILURE_RATE / 2 ? "cancelled" : "failed",
        );
      }

      const picked = MOCK_PROFILES[Math.floor(random() * MOCK_PROFILES.length)];
      return {
        riotId: picked.riotId,
        currentTier: picked.currentTier,
        ...mockAggregate(picked, random),
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}

export const mockProvider = createMockProvider();
