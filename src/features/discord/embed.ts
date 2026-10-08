import { MAPS, POSITION_LABELS, type MapKey } from "@/lib/constants";

import { formatSide, type Side } from "@/features/side/side";
import { formatScore, TEAM_NAMES } from "@/features/teams/format";

import type { SendKind, SendTeamPlayer, SendTeams } from "./payload";

/** 디스코드 임베드 한도 (https://discord.com/developers/docs/resources/message#embed-object-embed-limits) */
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  total: 6000,
} as const;

/** zero-width space — 멘션 무력화 · 빈 필드 값 */
const ZWSP = String.fromCharCode(0x200b);

export const DISCORD_USERNAME = "naejeon-kit";
/** 0xFF4655 — 앱 accent */
export const DISCORD_COLOR = 0xff4655;

export type DiscordEmbed = {
  title?: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer: { text: string };
};

export type DiscordMessage = {
  username: string;
  embeds: DiscordEmbed[];
  allowed_mentions: { parse: [] };
};

/**
 * 사용자 입력(닉네임)을 디스코드에 그대로 보내도 서식·멘션이 되지 않게.
 * - 마크다운 기호는 백슬래시로 이스케이프
 * - `@` 뒤에 zero-width space → @everyone · @here · <@id> 가 멘션으로 해석되지 않음
 * (allowed_mentions: { parse: [] } 로 알림도 막지만, 표시까지 무력화)
 */
export function escapeDiscord(text: string): string {
  return text
    .replace(/[\\*_~`|>#\-[\]()<:]/g, "\\$&")
    .replace(/@/g, `@${ZWSP}`);
}

/** 한도를 넘으면 잘라서 … 를 붙인다 */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** "타격대 · 주력", "자유", 포지션을 안 고른 멤버는 "" — 방장 화면 표시와 같은 규칙 */
function positionLabel(p: SendTeamPlayer): string {
  if (p.position === null) return "";
  if (p.position === "flex") return "자유";
  const label = POSITION_LABELS[p.position];
  if (p.proficiency === "main") return `${label} · 주력`;
  if (p.proficiency === "no") return `${label} · 불가`;
  return label;
}

function playerLine(p: SendTeamPlayer): string {
  const name = escapeDiscord(p.nickname);
  const position = positionLabel(p);
  return position ? `${name} — ${position}` : name;
}

/** 줄 단위로 넣다가 한도에 걸리면 남은 인원 수로 마무리 */
function joinLines(lines: string[], max: number): string {
  const all = lines.join("\n");
  if (all.length <= max) return all || ZWSP;
  for (let n = lines.length - 1; n > 0; n--) {
    const kept = [...lines.slice(0, n), `…외 ${lines.length - n}명`].join("\n");
    if (kept.length <= max) return kept;
  }
  return truncate(all, max);
}

const footer = (code: string) => ({
  text: truncate(`naejeon-kit · 방 코드 ${code}`, EMBED_LIMITS.footer),
});

export function teamsEmbed(teams: SendTeams, code: string): DiscordEmbed {
  return {
    title: "팀 구성",
    color: DISCORD_COLOR,
    fields: teams.map((team, i) => ({
      name: truncate(
        `${TEAM_NAMES[i]} (${formatScore(team.score)})`,
        EMBED_LIMITS.fieldName,
      ),
      value: joinLines(team.players.map(playerLine), EMBED_LIMITS.fieldValue),
      inline: true,
    })),
    footer: footer(code),
  };
}

export function mapEmbed(
  map: MapKey,
  bans: readonly MapKey[],
  code: string,
): DiscordEmbed {
  const lines: string[] = [MAPS[map]];
  if (bans.length) lines.push(`밴: ${bans.map((b) => MAPS[b]).join(" · ")}`);
  return {
    title: "이번 판 맵",
    description: truncate(lines.join("\n"), EMBED_LIMITS.description),
    color: DISCORD_COLOR,
    footer: footer(code),
  };
}

export function sideEmbed(team1: Side, code: string): DiscordEmbed {
  return {
    title: "공수",
    description: formatSide(team1),
    color: DISCORD_COLOR,
    footer: footer(code),
  };
}

export type MessageInput = {
  kind: SendKind;
  code: string;
  teams?: SendTeams | null;
  map?: { map: MapKey; bans: readonly MapKey[] } | null;
  side?: Side | null;
};

/**
 * 보낼 메시지. 보낼 내용이 없으면 null (예: 맵을 아직 안 돌렸는데 kind = map).
 * all 은 있는 것만 팀 → 맵 → 공수 순으로 embeds 하나에.
 */
export function buildDiscordMessage({
  kind,
  code,
  teams,
  map,
  side,
}: MessageInput): DiscordMessage | null {
  const embeds: DiscordEmbed[] = [];
  if ((kind === "teams" || kind === "all") && teams) {
    embeds.push(teamsEmbed(teams, code));
  }
  if ((kind === "map" || kind === "all") && map) {
    embeds.push(mapEmbed(map.map, map.bans, code));
  }
  if ((kind === "side" || kind === "all") && side) {
    embeds.push(sideEmbed(side, code));
  }
  if (!embeds.length) return null;
  return {
    username: DISCORD_USERNAME,
    embeds,
    allowed_mentions: { parse: [] },
  };
}
