import { ShieldIcon, SwordIcon } from "@/components/ui/icons";

import { otherSide, SIDE_LABELS, type Side } from "./side";

/** 시안 Side: 팀1 시작 진영 2칸 */
export function SideCards({ team1 }: { team1: Side | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["attack", "defense"] as const).map((side) => {
        const on = team1 === side;
        const Icon = side === "attack" ? SwordIcon : ShieldIcon;
        return (
          <div
            key={side}
            className={`flex h-[132px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 ${on ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface text-faint"}`}
          >
            <Icon size={28} className={on ? "text-accent" : ""} />
            <span className="text-xl font-bold">{SIDE_LABELS[side]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 시안 PcHost: 팀1/팀2 진영 2칸 (작은 카드) */
export function SideCardsCompact({ team1 }: { team1: Side | null }) {
  const team2 = team1 && otherSide(team1);
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { team: "팀1", side: team1, on: true },
        { team: "팀2", side: team2, on: false },
      ].map(({ team, side, on }) => (
        <div
          key={team}
          className={`flex h-[88px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 ${side && on ? "border-accent bg-accent-soft" : "border-line text-muted"}`}
        >
          <span className={`text-xs ${on && side ? "text-fg-2" : ""}`}>
            {team}
          </span>
          <span className="text-xl font-bold">
            {side ? SIDE_LABELS[side] : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
