import { NextResponse, type NextRequest } from "next/server";

import { isDiscordEnabled } from "@/features/discord/config";
import { buildDiscordMessage } from "@/features/discord/embed";
import { parseSendBody } from "@/features/discord/payload";
import {
  clearWebhook,
  getWebhookForSend,
  readRoomResults,
  type RoomResults,
  type Webhook,
} from "@/features/discord/server/db";
import { postWebhook } from "@/features/discord/server/discordApi";
import {
  jsonError,
  notFound,
  rpcErrorResponse,
} from "@/features/discord/server/http";

/**
 * 결과를 디스코드로 보낸다 (PRD F10). body { code, hostKey, kind, teams? }
 * - 맵 · 공수는 DB(rooms) 에서 직접 읽고, 팀은 방장 화면 상태라 body 로 받아 검증한다.
 * - 웹훅 id/token 은 응답에 싣지 않는다.
 */
export async function POST(req: NextRequest) {
  if (!isDiscordEnabled()) return notFound();

  const parsed = parseSendBody(await req.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { code, hostKey, kind, teams } = parsed.body;

  let results: RoomResults = { map: null, side: null };
  if (kind !== "teams") {
    try {
      results = await readRoomResults(code);
    } catch {
      return jsonError("SERVER_ERROR", 502);
    }
  }
  const message = buildDiscordMessage({ kind, code, teams, ...results });

  // 방장 확인 + 전송 제한(1분 10회)
  let webhook: Webhook;
  try {
    webhook = await getWebhookForSend(code, hostKey);
  } catch (e) {
    return rpcErrorResponse(e);
  }
  if (!message) return jsonError("NOTHING_TO_SEND", 409);

  const sent = await postWebhook(webhook, message).catch(() => null);
  if (!sent) return jsonError("DISCORD_FAILED", 502);
  if (sent.ok) return NextResponse.json({ ok: true });

  switch (sent.reason) {
    case "gone":
      // 디스코드에서 웹훅이 삭제됨 → 우리 쪽 연결도 해제
      await clearWebhook(code, hostKey).catch(() => null);
      return jsonError("DISCORD_DISCONNECTED", 410);
    case "rate_limited":
      return jsonError("DISCORD_RATE_LIMITED", 429, {
        retryAfter: sent.retryAfter,
      });
    default:
      return jsonError("DISCORD_FAILED", 502);
  }
}
