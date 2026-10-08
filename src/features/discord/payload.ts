import {
  NICKNAME_MAX_LENGTH,
  POSITIONS,
  PROFICIENCIES,
  TEAM_SIZE,
  type Position,
  type Proficiency,
} from "@/lib/constants";

import { isFreePositions } from "@/features/members/positionSummary";
import type { TeamResult } from "@/features/teams/types";

/** 디스코드로 보낼 결과 종류 (PRD F10) */
export const SEND_KINDS = ["teams", "map", "side", "all"] as const;
export type SendKind = (typeof SEND_KINDS)[number];

/**
 * 팀은 방장 화면 상태라 body 로 받는다. 서버가 그대로 임베드에 넣으므로 표시에 필요한 값만.
 * position: 배정된 칸 (`flex` = 자유), null = 포지션을 고르지 않은 멤버(표시 공백)
 */
export type SendTeamPlayer = {
  nickname: string;
  position: Position | "flex" | null;
  proficiency: Proficiency | null;
};
export type SendTeam = { score: number; players: SendTeamPlayer[] };
export type SendTeams = [SendTeam, SendTeam];

export type SendBody = {
  code: string;
  hostKey: string;
  kind: SendKind;
  teams?: SendTeams;
};

/** 방장 화면의 팀 결과 → 전송용 (닉네임·포지션·점수만) */
export function toSendTeams(result: TeamResult): SendTeams {
  const team = (i: 0 | 1): SendTeam => ({
    score: result.teams[i].score,
    players: result.teams[i].players.map((p) => ({
      nickname: p.member.nickname,
      position: isFreePositions(p.member.positions) ? null : p.slot,
      proficiency: p.slot === "flex" ? null : p.proficiency,
    })),
  });
  return [team(0), team(1)];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const POSITION_VALUES: readonly unknown[] = [...POSITIONS, "flex", null];
const PROFICIENCY_VALUES: readonly unknown[] = [...PROFICIENCIES, null];

function parsePlayer(v: unknown): SendTeamPlayer | null {
  if (!isObject(v)) return null;
  const { nickname, position, proficiency } = v;
  if (
    typeof nickname !== "string" ||
    nickname.trim().length < 1 ||
    nickname.length > NICKNAME_MAX_LENGTH ||
    !POSITION_VALUES.includes(position) ||
    !PROFICIENCY_VALUES.includes(proficiency)
  ) {
    return null;
  }
  return {
    nickname,
    position: position as SendTeamPlayer["position"],
    proficiency: proficiency as Proficiency | null,
  };
}

function parseTeam(v: unknown): SendTeam | null {
  if (!isObject(v)) return null;
  const { score, players } = v;
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 1000 ||
    !Array.isArray(players) ||
    players.length < 1 ||
    players.length > TEAM_SIZE
  ) {
    return null;
  }
  const parsed = players.map(parsePlayer);
  if (parsed.some((p) => p === null)) return null;
  return { score, players: parsed as SendTeamPlayer[] };
}

/** 팀 2개, 각 1~5명, 닉네임 1~16자, 포지션·숙련도 enum. 아니면 null */
export function parseSendTeams(v: unknown): SendTeams | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = parseTeam(v[0]);
  const b = parseTeam(v[1]);
  return a && b ? [a, b] : null;
}

export type ParseResult =
  { ok: true; body: SendBody } | { ok: false; error: string };

/** send 라우트 body 검증. kind 가 teams 면 teams 필수, all 이면 선택 */
export function parseSendBody(v: unknown): ParseResult {
  if (!isObject(v)) return { ok: false, error: "INVALID_BODY" };
  const { code, hostKey, kind, teams } = v;
  if (
    typeof code !== "string" ||
    !/^[A-Za-z0-9]{6}$/.test(code) ||
    typeof hostKey !== "string" ||
    hostKey.length < 1 ||
    hostKey.length > 200 ||
    !SEND_KINDS.includes(kind as SendKind)
  ) {
    return { ok: false, error: "INVALID_BODY" };
  }
  let parsedTeams: SendTeams | undefined;
  if (teams !== undefined && teams !== null) {
    const t = parseSendTeams(teams);
    if (!t) return { ok: false, error: "INVALID_TEAMS" };
    parsedTeams = t;
  } else if (kind === "teams") {
    return { ok: false, error: "INVALID_TEAMS" };
  }
  return {
    ok: true,
    body: {
      code: code.toUpperCase(),
      hostKey,
      kind: kind as SendKind,
      teams: parsedTeams,
    },
  };
}
