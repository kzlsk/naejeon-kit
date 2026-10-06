import type { ReactNode } from "react";

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

type MemberRowProps = {
  member: Member;
  isMe?: boolean;
  highlight?: boolean;
  /** 행 오른쪽 끝 (더보기 버튼, 포지션 등) */
  trailing?: ReactNode;
};

/** 모바일 리스트 행 — 시안 Host/Participant */
export function MemberRow({
  member,
  isMe,
  highlight,
  trailing,
}: MemberRowProps) {
  return (
    <li
      className={`border-line-subtle flex h-[54px] items-center gap-3 border-t ${highlight ? "bg-accent-soft/60 -mx-2 rounded-lg px-2" : ""}`}
    >
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
        {member.nickname}
        {isMe && <span className="text-muted ml-1">(나)</span>}
      </span>
      {member.currentTier && <TierIcon tier={member.currentTier} />}
      <TierText member={member} />
      {trailing}
    </li>
  );
}

/** PC 카드 그리드 셀 — 시안 PcParticipant */
export function MemberCard({
  member,
  isMe,
}: {
  member: Member;
  isMe?: boolean;
}) {
  const pos = positionSummary(member.positions);
  return (
    <li
      className={`bg-panel flex items-center gap-3 rounded-xl border px-3.5 py-3 ${isMe ? "border-line-strong" : "border-line-subtle"}`}
    >
      <TierIcon tier={member.currentTier} size={34} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">
          {member.nickname}
          {isMe && <span className="text-muted ml-1 font-normal">(나)</span>}
        </span>
        {member.currentTier ? (
          <span className="text-muted truncate text-xs">
            {formatTier(member.currentTier)}
            {pos && ` · ${pos}`}
          </span>
        ) : (
          <span className="text-danger text-xs">정보 미입력</span>
        )}
      </div>
    </li>
  );
}
