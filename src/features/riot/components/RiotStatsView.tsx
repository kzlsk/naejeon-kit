import { STATS_MIN_MATCHES } from "../computeStats";
import {
  formatAcs,
  formatPct,
  hasEnoughMatches,
  winRateClass,
} from "../format";
import type { RiotStats } from "../types";
import { HitDistribution } from "./HitDistribution";
import { StatTile, StatTileGrid } from "./StatTile";

/**
 * 핵심 지표 타일 2개(승률·평균 ACS) + 명중 분포. 5판 미만이면 빈 상태 카드.
 * 헤드샷 %는 명중 분포의 "머리" 줄에 있어서 타일로 따로 두지 않는다.
 * 지표를 합친 점수·등급·순위·"상위 N%" 같은 비교 표현은 만들지 않는다 (라이엇 정책).
 */
export function RiotStatsView({ stats }: { stats: RiotStats | null }) {
  const count = stats?.matchCount ?? 0;
  if (!hasEnoughMatches(stats)) {
    return (
      <div className="bg-surface flex flex-col items-center gap-1 rounded-xl px-4 py-6 text-center">
        <p className="text-fg-2 text-sm font-medium">
          이번 액트 기록이 부족해요 ({count}판)
        </p>
        <p className="text-faint text-xs">
          경쟁전을 {STATS_MIN_MATCHES}판 이상 하면 지표가 보여요
        </p>
      </div>
    );
  }

  const losses = stats.matchCount - stats.wins;

  return (
    <div className="flex flex-col gap-2">
      <StatTileGrid>
        <StatTile
          label="승률"
          value={formatPct(stats.winRate)}
          valueClassName={winRateClass(stats.winRate)}
          caption={`${stats.wins}승 ${losses}패`}
        />
        <StatTile
          label="평균 ACS"
          value={formatAcs(stats.avgAcs)}
          caption="라운드당 평균 전투 점수"
        />
      </StatTileGrid>
      <HitDistribution
        head={stats.headshotPct}
        body={stats.bodyshotPct}
        leg={stats.legshotPct}
      />
    </div>
  );
}
