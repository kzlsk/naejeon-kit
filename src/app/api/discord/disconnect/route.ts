import { NextResponse, type NextRequest } from "next/server";

import { isDiscordEnabled } from "@/features/discord/config";
import { clearWebhook } from "@/features/discord/server/db";
import { deleteWebhook } from "@/features/discord/server/discordApi";
import {
  jsonError,
  notFound,
  readHostBody,
  rpcErrorResponse,
} from "@/features/discord/server/http";

/** 연결 해제 (PRD F10): 우리 쪽 저장값을 지우고, 디스코드 쪽 웹훅도 삭제 (실패해도 무시) */
export async function POST(req: NextRequest) {
  if (!isDiscordEnabled()) return notFound();

  const body = await readHostBody(req);
  if (!body) return jsonError("INVALID_BODY", 400);

  let webhook;
  try {
    webhook = await clearWebhook(body.code, body.hostKey);
  } catch (e) {
    return rpcErrorResponse(e);
  }
  if (webhook) await deleteWebhook(webhook);
  return NextResponse.json({ ok: true });
}
