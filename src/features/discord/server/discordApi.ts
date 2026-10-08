import type { DiscordOAuthConfig } from "../config";
import type { DiscordMessage } from "../embed";
import type { Webhook } from "./db";

const API = "https://discord.com/api";

export type TokenResult = { webhook: Webhook; guildName: string | null };

/**
 * OAuth2 code → 토큰 교환 (scope webhook.incoming). 응답의 webhook 만 쓰고
 * access/refresh 토큰은 저장하지 않고 버린다.
 */
export async function exchangeCode(
  config: DiscordOAuthConfig,
  code: string,
): Promise<TokenResult> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`discord token exchange → HTTP ${res.status}`);
  const body = (await res.json()) as {
    webhook?: { id?: unknown; token?: unknown };
    guild?: { name?: unknown };
  };
  const id = body.webhook?.id;
  const token = body.webhook?.token;
  if (typeof id !== "string" || typeof token !== "string") {
    throw new Error("discord token response has no webhook");
  }
  const guildName = body.guild?.name;
  return {
    webhook: { id, token },
    guildName: typeof guildName === "string" ? guildName.slice(0, 100) : null,
  };
}

export type PostResult =
  | { ok: true }
  /** 웹훅이 디스코드에서 삭제됨 (404 / 401) */
  | { ok: false; reason: "gone" }
  /** 초 단위 */
  | { ok: false; reason: "rate_limited"; retryAfter: number }
  | { ok: false; reason: "failed"; status: number };

const webhookUrl = (w: Webhook) =>
  `${API}/webhooks/${encodeURIComponent(w.id)}/${encodeURIComponent(w.token)}`;

export async function postWebhook(
  webhook: Webhook,
  message: DiscordMessage,
): Promise<PostResult> {
  const res = await fetch(`${webhookUrl(webhook)}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  if (res.status === 404 || res.status === 401)
    return { ok: false, reason: "gone" };
  if (res.status === 429) {
    const body = (await res.json().catch(() => null)) as {
      retry_after?: unknown;
    } | null;
    const retryAfter =
      typeof body?.retry_after === "number"
        ? body.retry_after
        : Number(res.headers.get("retry-after")) || 1;
    return { ok: false, reason: "rate_limited", retryAfter };
  }
  return { ok: false, reason: "failed", status: res.status };
}

/** 연결 해제 시 디스코드 쪽 웹훅도 지운다. 실패해도 무시 */
export async function deleteWebhook(webhook: Webhook): Promise<void> {
  try {
    await fetch(webhookUrl(webhook), { method: "DELETE", cache: "no-store" });
  } catch {}
}
