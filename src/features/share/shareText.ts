import { MAPS, type MapKey } from "@/lib/constants";

import { formatSide, type Side } from "@/features/side/side";
import {
  formatScore,
  playerPositionLabel,
  TEAM_NAMES,
} from "@/features/teams/format";
import type { TeamResult } from "@/features/teams/types";

type ShareInput = {
  map: MapKey | null;
  side: Side | null;
  teams: TeamResult | null;
};

/** 디코에 붙여넣을 결과 텍스트. 없는 항목은 생략. */
export function buildShareText({ map, side, teams }: ShareInput): string {
  const lines = ["내전 결과"];
  if (map) lines.push(`맵: ${MAPS[map]}`);
  if (side) lines.push(formatSide(side));

  teams?.teams.forEach((team, i) => {
    lines.push("", `[${TEAM_NAMES[i]}] (${formatScore(team.score)})`);
    for (const p of team.players) {
      lines.push(`- ${p.member.nickname} — ${playerPositionLabel(p)}`);
    }
  });

  return lines.join("\n");
}
