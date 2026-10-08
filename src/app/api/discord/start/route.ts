import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  getDiscordOAuthConfig,
  isDiscordEnabled,
} from "@/features/discord/config";
import { verifyHost } from "@/features/discord/server/db";
import {
  jsonError,
  notFound,
  OAUTH_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  readHostBody,
} from "@/features/discord/server/http";

/**
 * [디스코드 연결] (PRD F10): 방장 확인 → state 쿠키 → 디스코드 인가 URL.
 * 클라이언트는 받은 url 로 이동한다.
 */
export async function POST(req: NextRequest) {
  if (!isDiscordEnabled()) return notFound();
  const config = getDiscordOAuthConfig();
  if (!config) return jsonError("DISCORD_NOT_CONFIGURED", 503);

  const body = await readHostBody(req);
  if (!body) return jsonError("INVALID_BODY", 400);

  let ok: boolean;
  try {
    ok = await verifyHost(body.code, body.hostKey);
  } catch {
    return jsonError("SERVER_ERROR", 502);
  }
  if (!ok) return jsonError("FORBIDDEN", 403);

  const state = randomBytes(24).toString("hex");
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "webhook.incoming",
    redirect_uri: config.redirectUri,
    state,
  }).toString();

  const res = NextResponse.json({ url: url.toString() });
  res.cookies.set(
    OAUTH_COOKIE,
    JSON.stringify({ state, code: body.code, hostKey: body.hostKey }),
    OAUTH_COOKIE_OPTIONS,
  );
  return res;
}
