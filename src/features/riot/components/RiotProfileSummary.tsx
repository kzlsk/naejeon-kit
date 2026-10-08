import type { Tier } from "@/lib/constants";

import type { RiotStats, RiotTopAgent } from "../types";
import { RiotProfileHeader } from "./RiotProfileHeader";
import { RiotStatsView } from "./RiotStatsView";
import { TopAgentsList } from "./TopAgentsList";

type RiotProfileSummaryProps = {
  riotId: string;
  tier: Tier | null;
  /** 멤버가 입력한 최티 */
  peakTier: Tier | null;
  topAgents: RiotTopAgent[];
  stats: RiotStats | null;
  /** 없으면 "연결 해제" 버튼 숨김 */
  onDisconnect?: () => void;
};

const CARD =
  "@container border-line bg-bg flex flex-col gap-4 rounded-2xl border p-4";
/** 넓을 때 2열: 왼쪽 헤더·지표, 오른쪽 요원 */
const COLUMNS = "grid gap-4 @2xl:grid-cols-2 @2xl:items-start";

/**
 * 라이엇 정보 카드 — 내 정보 카드·멤버 수정 화면에서만 쓴다.
 * 멤버 목록·팀 결과에는 RiotLinkedBadge 만.
 */
export function RiotProfileSummary({
  riotId,
  tier,
  peakTier,
  topAgents,
  stats,
  onDisconnect,
}: RiotProfileSummaryProps) {
  return (
    <section aria-label="연결된 라이엇 계정" className={CARD}>
      <div className={COLUMNS}>
        <div className="flex flex-col gap-4">
          <RiotProfileHeader
            riotId={riotId}
            tier={tier}
            peakTier={peakTier}
            matchCount={stats?.matchCount ?? null}
          />
          <RiotStatsView stats={stats} />
        </div>
        <TopAgentsList topAgents={topAgents} />
      </div>
      <footer className="border-line-subtle flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-faint text-xs">
          라이엇 계정 연결로 불러온 정보 · 이번 액트 경쟁전 기준
        </p>
        {onDisconnect && (
          <button
            type="button"
            onClick={onDisconnect}
            className="text-muted hover:text-fg -my-2 h-11 shrink-0 cursor-pointer px-1 text-xs underline underline-offset-2"
          >
            연결 해제
          </button>
        )}
      </footer>
    </section>
  );
}

function Bone({ className }: { className: string }) {
  return <div className={`bg-surface-active rounded-md ${className}`} />;
}

/** 연결 중 — 같은 레이아웃의 스켈레톤 */
export function RiotProfileSkeleton() {
  return (
    <section
      aria-label="라이엇 정보 불러오는 중"
      aria-busy
      className={`${CARD} animate-pulse`}
    >
      <div className={COLUMNS}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <Bone className="size-16 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-5 w-32" />
              <Bone className="h-3.5 w-44" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="bg-surface flex flex-col gap-2 rounded-xl px-3.5 py-3"
              >
                <Bone className="h-3 w-10" />
                <Bone className="h-7 w-14" />
                <Bone className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="bg-surface flex items-center gap-5 rounded-xl px-4 py-3.5">
            <Bone className="h-24 w-12" />
            <div className="flex flex-1 flex-col gap-3">
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-full" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-12 items-center gap-3 px-2.5">
              <Bone className="size-8 rounded-lg" />
              <Bone className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <p className="text-faint text-xs">라이엇 계정에서 정보를 불러오는 중…</p>
    </section>
  );
}

/** 멤버 목록·팀 결과용 작은 뱃지 */
export function RiotLinkedBadge() {
  return (
    <span className="border-line-strong text-muted ml-1.5 inline-flex shrink-0 items-center rounded border px-1 align-middle text-[10px] leading-4 font-medium">
      연결됨
    </span>
  );
}
