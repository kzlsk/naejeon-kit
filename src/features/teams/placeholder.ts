import { POSITIONS, TEAM_SIZE } from "@/lib/constants";

import type { Member } from "@/features/members/types";

import { memberScore } from "./score";
import type { Team, TeamPlayer, TeamResult } from "./types";

/**
 * 임시 팀 나누기 — 목록 순서대로 앞 5명 / 뒤 5명, 포지션도 순서대로 배정.
 * TODO(마일스톤 5): PRD §6 알고리즘(generateTeams)으로 교체.
 */
export function placeholderTeams(members: Member[]): TeamResult {
  const toTeam = (list: Member[]): Team => {
    const players: TeamPlayer[] = list.map((member, i) => {
      const slot: TeamPlayer["slot"] =
        i < POSITIONS.length ? POSITIONS[i] : "flex";
      return {
        member,
        score: memberScore(member.currentTier, member.peakTier) ?? 0,
        slot,
        recommended: slot === "flex" ? null : slot,
        proficiency: slot === "flex" ? null : member.positions[slot],
      };
    });
    return {
      players,
      score: players.reduce((sum, p) => sum + p.score, 0),
      missing: players
        .filter((p) => p.proficiency === "no")
        .map((p) => p.slot)
        .filter((s) => s !== "flex"),
    };
  };
  return {
    teams: [
      toTeam(members.slice(0, TEAM_SIZE)),
      toTeam(members.slice(TEAM_SIZE, TEAM_SIZE * 2)),
    ],
  };
}
