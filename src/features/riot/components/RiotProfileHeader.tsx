import type { Tier } from "@/lib/constants";

import { TierIcon } from "@/features/members/TierIcon";
import { formatTier } from "@/features/members/tier";

type RiotProfileHeaderProps = {
  riotId: string;
  tier: Tier | null;
  /** 멤버가 입력한 최티 (Riot 에서 받은 값 아님) */
  peakTier: Tier | null;
  /** 집계한 판 수. null 이면 칩 숨김 */
  matchCount: number | null;
};

/** "철수#KR1" → ["철수", "#KR1"] */
function splitRiotId(riotId: string): [name: string, tag: string] {
  const hash = riotId.lastIndexOf("#");
  return hash === -1
    ? [riotId, ""]
    : [riotId.slice(0, hash), riotId.slice(hash)];
}

/** 현티 엠블럼 + Riot ID + 티어 줄 + "이번 액트 최근 N판" 칩 */
export function RiotProfileHeader({
  riotId,
  tier,
  peakTier,
  matchCount,
}: RiotProfileHeaderProps) {
  const [name, tag] = splitRiotId(riotId);
  return (
    <header className="flex items-center gap-3.5">
      <TierIcon tier={tier} size={64} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-lg leading-tight">
            <span className="font-bold">{name}</span>
            <span className="text-faint font-mono text-[15px]">{tag}</span>
          </p>
          {matchCount !== null && (
            <span className="border-line text-muted shrink-0 rounded-full border px-2 py-0.5 text-[11px]">
              이번 액트 최근 {matchCount}판
            </span>
          )}
        </div>
        <p className="text-muted flex flex-wrap items-center gap-x-1.5 text-[13px]">
          <span>
            현재{" "}
            <span className="text-fg-2 font-medium">
              {tier ? formatTier(tier) : "티어 정보 없음"}
            </span>
          </span>
          {peakTier && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                최티
                <TierIcon tier={peakTier} size={20} />
                <span className="text-fg-2 font-medium">
                  {formatTier(peakTier)}
                </span>
              </span>
            </>
          )}
        </p>
      </div>
    </header>
  );
}
