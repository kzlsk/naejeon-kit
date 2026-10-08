import type { ReactNode } from "react";

import { IconButton } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";

import {
  RiotLinkedBadge,
  RiotProfileSummary,
} from "@/features/riot/components/RiotProfileSummary";

import { playablePositions } from "./positionSummary";
import { TierIcon } from "./TierIcon";
import { formatTier } from "./tier";
import type { Member } from "./types";

type MemberDetailPanelProps = {
  /** null 이면 빈 상태 (방장 기본) */
  member: Member | null;
  title: string;
  /** [수정][삭제] — 참가자 본인 / 방장일 때만 */
  actions?: ReactNode;
  /** 참가자가 다른 멤버를 볼 때 [내 정보로] */
  onBackToMe?: () => void;
  /** 상세 닫기 (X) — PC 패널에서 기본 선택으로 돌아간다. 하단 시트는 시트 자체 닫기를 쓴다 */
  onClose?: () => void;
  /** 하단 시트처럼 바깥에 제목이 이미 있으면 숨김 */
  hideTitle?: boolean;
  emptyMessage?: string;
};

/**
 * 멤버 상세 — 헤더(티어·이름·연결됨·포지션 칩) + 라이엇 연결 시 전적 카드 전체.
 * PC 왼쪽 패널과 모바일 하단 시트에서 같이 쓴다.
 */
export function MemberDetailPanel({
  member,
  title,
  actions,
  onBackToMe,
  onClose,
  hideTitle,
  emptyMessage = "멤버를 눌러 정보를 확인하세요",
}: MemberDetailPanelProps) {
  if (!member) {
    return (
      <section
        aria-label="멤버 정보"
        className="border-line text-muted flex min-h-24 items-center justify-center rounded-[14px] border border-dashed px-4 text-center text-sm"
      >
        {emptyMessage}
      </section>
    );
  }

  const chips = playablePositions(member.positions);
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      {onBackToMe && (
        <button
          type="button"
          onClick={onBackToMe}
          className="text-muted hover:text-fg -my-1 h-9 cursor-pointer self-start text-[13px] underline-offset-2 hover:underline"
        >
          ← 내 정보로
        </button>
      )}
      {(!hideTitle || actions || onClose) && (
        <div className="flex min-h-9 items-center justify-between gap-2">
          {!hideTitle && (
            <h2 className="text-muted lg:text-fg min-w-0 truncate text-xs lg:text-[15px] lg:font-semibold">
              {title}
            </h2>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            {onClose && (
              <IconButton
                aria-label="상세 닫기"
                onClick={onClose}
                className="-mr-2.5 size-9"
              >
                <CloseIcon size={18} />
              </IconButton>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <TierIcon tier={member.currentTier} size={36} />
        <span className="min-w-0 truncate text-xl font-bold">
          {member.nickname}
        </span>
        {member.riotId && <RiotLinkedBadge />}
        <span className="text-muted shrink-0 text-sm">
          {member.currentTier ? formatTier(member.currentTier) : "티어 미입력"}
          {member.peakTier && ` · 최티 ${formatTier(member.peakTier)}`}
        </span>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((p) => (
            <span
              key={p.pos}
              className={`rounded-full px-2.5 py-1 text-xs ${p.main ? "bg-fg text-bg font-semibold" : "border-line-strong text-fg-2 border"}`}
            >
              {p.main ? `${p.label} · 주력` : p.label}
            </span>
          ))}
        </div>
      )}
      {member.riotId ? (
        <RiotProfileSummary
          riotId={member.riotId}
          tier={member.currentTier}
          peakTier={member.peakTier}
          topAgents={member.topAgents ?? []}
          stats={member.riotStats ?? null}
        />
      ) : (
        <p className="bg-surface text-muted rounded-xl px-4 py-3 text-[13px]">
          라이엇 계정이 연결되지 않았어요
        </p>
      )}
    </section>
  );
}
