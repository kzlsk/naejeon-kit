import { ShieldIcon, SwordIcon, WarnIcon } from "@/components/ui/icons";
import { POSITION_LABELS } from "@/lib/constants";

import { TierIcon } from "@/features/members/TierIcon";
import { RiotLinkedBadge } from "@/features/riot/components/RiotProfileSummary";
import { SIDE_LABELS, type Side } from "@/features/side/side";

import { formatScore, playerPositionLabel, TEAM_NAMES } from "./format";
import type { Team, TeamPlayer } from "./types";

export const TEAM_COLOR = ["bg-team1", "bg-team2"] as const;
const TEAM_TEXT = ["text-team1", "text-team2"] as const;

function positionClass(p: TeamPlayer) {
  if (p.slot === "flex") return "text-faint";
  if (p.proficiency === "no") return "text-warn";
  if (p.proficiency === "main") return "font-semibold text-fg";
  return "text-muted";
}

type SwapProps = {
  /** 첫 번째로 고른 선수 (accent 테두리) */
  selectedId: string | null;
  onPick: (memberId: string) => void;
};

function PlayerLine({ p, isMe }: { p: TeamPlayer; isMe?: boolean }) {
  return (
    <>
      <TierIcon
        tier={p.member.currentTier}
        size={24}
        className="hidden lg:inline-flex"
      />
      <span
        className={`min-w-0 flex-1 truncate text-[15px] ${isMe ? "font-semibold" : ""}`}
      >
        {p.member.nickname}
        {p.member.riotId && <RiotLinkedBadge />}
        {isMe && <span className="text-muted ml-1 font-normal">(나)</span>}
      </span>
      <span className={`text-[13px] ${positionClass(p)}`}>
        {playerPositionLabel(p)}
      </span>
    </>
  );
}

/** 팀 시작 진영 배지 (공수 랜덤 결과, F7) */
export function SideBadge({ side }: { side: Side }) {
  const Icon = side === "attack" ? SwordIcon : ShieldIcon;
  return (
    <span className="border-line-strong text-fg-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <Icon size={12} />
      {SIDE_LABELS[side]}
    </span>
  );
}

/**
 * 팀 카드 — 시안 Teams / PcHost.
 * swap 을 주면 선수 교체 모드: 행이 버튼이 되고 고른 선수는 accent 테두리 (F5-6)
 * side: 이 팀의 시작 진영. meId: 참가자 본인 행 강조 (F5-7)
 */
export function TeamCard({
  team,
  index,
  swap,
  side,
  meId,
}: {
  team: Team;
  index: 0 | 1;
  swap?: SwapProps;
  side?: Side | null;
  meId?: string;
}) {
  return (
    <section
      aria-label={TEAM_NAMES[index]}
      className="bg-surface overflow-hidden rounded-[14px] lg:rounded-2xl"
    >
      <header className="border-line flex items-center justify-between border-b px-4 py-3 lg:px-5 lg:py-4">
        <div className="flex items-center gap-2 lg:gap-2.5">
          <span
            className={`size-2.5 rounded-[3px] lg:size-3 ${TEAM_COLOR[index]}`}
          />
          <h3 className="text-[15px] font-bold lg:text-lg">
            {TEAM_NAMES[index]}
          </h3>
          {side && <SideBadge side={side} />}
        </div>
        <span
          className={`font-mono text-[15px] font-semibold lg:text-lg ${TEAM_TEXT[index]}`}
        >
          {formatScore(team.score)}
        </span>
      </header>
      <ul className={swap ? "flex flex-col gap-1 p-1.5" : "py-1 lg:py-1.5"}>
        {team.players.map((p) =>
          swap ? (
            <li key={p.member.id}>
              <button
                type="button"
                aria-pressed={swap.selectedId === p.member.id}
                onClick={() => swap.onPick(p.member.id)}
                className={`hover:bg-surface-active focus-visible:ring-accent/60 flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-[10px] border px-2.5 text-left outline-none focus-visible:ring-2 lg:h-12 lg:gap-3 lg:px-3.5 ${swap.selectedId === p.member.id ? "border-accent bg-accent-soft" : "border-transparent"}`}
              >
                <PlayerLine p={p} />
              </button>
            </li>
          ) : (
            <li
              key={p.member.id}
              className={`flex h-[42px] items-center gap-2.5 px-4 lg:h-12 lg:gap-3 lg:px-5 ${p.member.id === meId ? "bg-accent-soft/60" : ""}`}
            >
              <PlayerLine p={p} isMe={p.member.id === meId} />
            </li>
          ),
        )}
      </ul>
      {team.missing.length > 0 && (
        <p className="bg-warn-bg text-warn mx-3 mb-3 hidden rounded-[10px] px-3 py-2.5 text-[13px] lg:block">
          {team.missing.map((pos) => POSITION_LABELS[pos]).join(", ")} 가능 인원
          없음
        </p>
      )}
    </section>
  );
}

export function WarningBanner({ message }: { message: string }) {
  return (
    <div className="bg-warn-bg text-warn flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm">
      <WarnIcon size={18} className="flex-none" />
      <span>{message}</span>
    </div>
  );
}
