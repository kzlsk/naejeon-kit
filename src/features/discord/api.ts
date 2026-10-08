import type { HostAuth } from "@/features/members/api";
import type { TeamResult } from "@/features/teams/types";

import { toSendTeams, type SendKind } from "./payload";

export type DiscordFailure = { ok: false; error: string; retryAfter?: number };
export type DiscordResult = { ok: true } | DiscordFailure;

/** /api/discord/* 호출. 성공이면 응답 JSON, 실패면 서버 에러 코드 (네트워크 실패는 NETWORK) */
async function post(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | DiscordFailure> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (res.ok) return { ok: true, data };
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : `HTTP_${res.status}`,
      retryAfter:
        typeof data.retryAfter === "number" ? data.retryAfter : undefined,
    };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

const hostBody = (host: HostAuth) => ({
  code: host.code,
  hostKey: host.hostKey,
});

/** 디스코드 인가 URL (방장 확인 + state 쿠키는 서버가) */
export async function startDiscordConnect(
  host: HostAuth,
): Promise<{ ok: true; url: string } | DiscordFailure> {
  const r = await post("/api/discord/start", hostBody(host));
  if (!r.ok) return r;
  return typeof r.data.url === "string"
    ? { ok: true, url: r.data.url }
    : { ok: false, error: "SERVER_ERROR" };
}

/** 팀은 방장 화면 상태라 같이 보낸다. 맵 · 공수는 서버가 DB 에서 읽는다 */
export async function sendToDiscord(
  host: HostAuth,
  kind: SendKind,
  teams: TeamResult | null,
): Promise<DiscordResult> {
  const withTeams = teams && (kind === "teams" || kind === "all");
  const r = await post("/api/discord/send", {
    ...hostBody(host),
    kind,
    teams: withTeams ? toSendTeams(teams) : undefined,
  });
  return r.ok ? { ok: true } : r;
}

export async function disconnectDiscord(
  host: HostAuth,
): Promise<DiscordResult> {
  const r = await post("/api/discord/disconnect", hostBody(host));
  return r.ok ? { ok: true } : r;
}
