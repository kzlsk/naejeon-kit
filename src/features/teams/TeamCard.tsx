import { WarnIcon } from "@/components/ui/icons";
import { POSITION_LABELS } from "@/lib/constants";

import { TierIcon } from "@/features/members/TierIcon";

import { formatScore, playerPositionLabel, TEAM_NAMES } from "./format";
import type { Team, TeamPlayer } from "./types";

const TEAM_COLOR = ["bg-team1", "bg-team2"] as const;
const TEAM_TEXT = ["text-team1", "text-team2"] as const;

function positionClass(p: TeamPlayer) {
  if (p.slot === "flex") return "text-faint";
  if (p.proficiency === "no") return "text-warn";
  if (p.proficiency === "main") return "font-semibold text-fg";
  return "text-muted";
}

/** 팀 카드 — 시안 Teams / PcHost */
export function TeamCard({ team, index }: { team: Team; index: 0 | 1 }) {
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
        </div>
        <span
          className={`font-mono text-[15px] font-semibold lg:text-lg ${TEAM_TEXT[index]}`}
        >
          {formatScore(team.score)}
        </span>
      </header>
      <ul className="py-1 lg:py-1.5">
        {team.players.map((p) => (
          <li
            key={p.member.id}
            className="flex h-[42px] items-center gap-2.5 px-4 lg:h-12 lg:gap-3 lg:px-5"
          >
            <TierIcon
              tier={p.member.currentTier}
              size={24}
              className="hidden lg:inline-flex"
            />
            <span className="min-w-0 flex-1 truncate text-[15px]">
              {p.member.nickname}
            </span>
            <span className={`text-[13px] ${positionClass(p)}`}>
              {playerPositionLabel(p)}
            </span>
          </li>
        ))}
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
