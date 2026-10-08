import type { ReactNode } from "react";

import { POSITION_LABELS } from "@/lib/constants";

import { RiotLinkedBadge } from "@/features/riot/components/RiotProfileSummary";
import { AgentIcon } from "@/features/riot/components/TopAgentsList";
import {
  formatAcs,
  formatPct,
  hasEnoughMatches,
  winRateClass,
} from "@/features/riot/format";

import { TierIcon } from "./TierIcon";
import { formatTier } from "./tier";
import { positionSummary } from "./positionSummary";
import type { Member } from "./types";

export function TierText({ member }: { member: Member }) {
  if (!member.currentTier) {
    return <span className="text-danger text-[13px]">정보 미입력</span>;
  }
  return (
    <span className="text-muted text-[13px]">
      {formatTier(member.currentTier)}
    </span>
  );
}

/** 지표 한 칸 — 위 값, 아래 라벨 (고정 폭이라 행끼리 세로로 정렬된다) */
function StatCell({ top, label }: { top: ReactNode; label: ReactNode }) {
  return (
    <span className="flex w-11 flex-col items-center gap-0.5">
      <span className="flex h-6 items-center">{top}</span>
      <span className="text-faint w-full truncate text-center text-[10px] leading-3">
        {label}
      </span>
    </span>
  );
}

/**
 * 라이엇 연결 멤버의 오른쪽 지표 열 — 승률 · ACS · 1순위 요원 (각각 고정 폭).
 * 연결 안 한 멤버는 영역 자체를 그리지 않는다. 5판 미만이면 승률·ACS 두 칸 자리에 "기록 부족".
 * 합산 점수·등급 없음.
 */
export function RiotMemberSummary({ member }: { member: Member }) {
  if (!member.riotId) return null;
  const stats = member.riotStats;
  const top = member.topAgents?.[0];
  return (
    <span
      data-testid="riot-summary"
      className="border-line-subtle flex shrink-0 items-center border-l pl-2 tabular-nums"
    >
      {hasEnoughMatches(stats) ? (
        <>
          <StatCell
            top={
              <span
                className={`font-mono text-sm font-semibold ${winRateClass(stats.winRate)}`}
              >
                {formatPct(stats.winRate)}
              </span>
            }
            label="승률"
          />
          <StatCell
            top={
              <span className="text-fg font-mono text-sm font-semibold">
                {formatAcs(stats.avgAcs)}
              </span>
            }
            label="ACS"
          />
        </>
      ) : (
        <span className="text-faint flex w-22 items-center justify-center text-[11px]">
          기록 부족
        </span>
      )}
      {top ? (
        <StatCell
          top={<AgentIcon name={top.agent} size={24} />}
          label={
            <>
              {top.agent}
              <span className="sr-only">
                {" "}
                · {POSITION_LABELS[top.position]}
              </span>
            </>
          }
        />
      ) : (
        <span className="w-11" aria-hidden />
      )}
    </span>
  );
}

type MemberItemProps = {
  member: Member;
  isMe?: boolean;
  /** 상세 패널에 보이는 멤버 — accent 테두리 */
  selected?: boolean;
  /** 방장: 티어 미입력 멤버 강조 */
  highlight?: boolean;
  onSelect: (id: string) => void;
};

/**
 * 한 줄 구성 — [티어 엠블럼(행 높이)] [이름 / 티어·포지션] [지표 열]
 * 엠블럼은 글자 크기가 아니라 행 높이에 맞춘다.
 */
function MemberLine({
  member,
  isMe,
}: Pick<MemberItemProps, "member" | "isMe">) {
  const pos = positionSummary(member.positions);
  return (
    <>
      <TierIcon tier={member.currentTier} size={40} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center">
          <span className="truncate text-[15px] leading-5 font-semibold">
            {member.nickname}
          </span>
          {isMe && (
            <span className="text-muted ml-1 shrink-0 text-[13px]">(나)</span>
          )}
          {member.riotId && <RiotLinkedBadge />}
        </span>
        <span className="truncate text-xs leading-4">
          {member.currentTier ? (
            <span className="text-muted">{formatTier(member.currentTier)}</span>
          ) : (
            <span className="text-danger">정보 미입력</span>
          )}
          {pos && <span className="text-faint"> · {pos}</span>}
        </span>
      </span>
      <RiotMemberSummary member={member} />
    </>
  );
}

const ITEM_BUTTON =
  "flex w-full cursor-pointer items-center gap-3 border text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

/** 모바일 리스트 행 / 방장 목록 행 — 행 전체가 버튼 */
export function MemberRow({
  member,
  isMe,
  selected,
  highlight,
  onSelect,
}: MemberItemProps) {
  return (
    <li className="border-line-subtle border-t py-1 first:border-t-0">
      <button
        type="button"
        aria-pressed={!!selected}
        onClick={() => onSelect(member.id)}
        className={`${ITEM_BUTTON} min-h-14 rounded-lg px-2 py-2 ${selected ? "border-accent" : "border-transparent"} ${highlight ? "bg-accent-soft/60" : "hover:bg-surface/60"}`}
      >
        <MemberLine member={member} isMe={isMe} />
      </button>
    </li>
  );
}

/** PC 카드 그리드 셀 — 시안 PcParticipant. 카드 전체가 버튼 */
export function MemberCard({
  member,
  isMe,
  selected,
  onSelect,
}: MemberItemProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={!!selected}
        onClick={() => onSelect(member.id)}
        className={`${ITEM_BUTTON} bg-panel hover:bg-surface h-full min-h-16 rounded-xl px-3 py-2.5 ${selected ? "border-accent" : isMe ? "border-line-strong" : "border-line-subtle"}`}
      >
        <MemberLine member={member} isMe={isMe} />
      </button>
    </li>
  );
}
