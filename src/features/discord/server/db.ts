import type { MapKey } from "@/lib/constants";
import { getServerSupabase, serverRpc } from "@/lib/supabase/server";

import type { Side } from "@/features/side/side";

/** 디스코드 웹훅 (비밀값 — 서버 라우트 밖으로 내보내지 않는다) */
export type Webhook = { id: string; token: string };

const host = (code: string, hostKey: string) => ({
  p_code: code,
  p_host_key: hostKey,
});

export function verifyHost(code: string, hostKey: string) {
  return serverRpc<boolean>("verify_host", host(code, hostKey));
}

export function setWebhook(
  code: string,
  hostKey: string,
  webhook: Webhook,
  guildName: string | null,
) {
  return serverRpc<void>("set_discord_webhook", {
    ...host(code, hostKey),
    p_webhook_id: webhook.id,
    p_webhook_token: webhook.token,
    p_guild_name: guildName,
  });
}

/** 지우기 전 웹훅 (없었으면 null) */
export async function clearWebhook(
  code: string,
  hostKey: string,
): Promise<Webhook | null> {
  const r = await serverRpc<{ id: string | null; token: string | null }>(
    "clear_discord_webhook",
    host(code, hostKey),
  );
  return r?.id && r.token ? { id: r.id, token: r.token } : null;
}

/** 전송 제한(1분 10회) 검사 포함. DISCORD_NOT_CONNECTED / DISCORD_RATE_LIMITED / FORBIDDEN */
export function getWebhookForSend(code: string, hostKey: string) {
  return serverRpc<Webhook>(
    "get_discord_webhook_for_send",
    host(code, hostKey),
  );
}

export type RoomResults = {
  map: { map: MapKey; bans: MapKey[] } | null;
  side: Side | null;
};

/** 맵 · 공수는 클라이언트 값을 믿지 않고 DB(rooms) 에서 읽는다 */
export async function readRoomResults(code: string): Promise<RoomResults> {
  const { data, error } = await getServerSupabase()
    .from("rooms")
    .select("result_map, map_bans, side_team1")
    .eq("code", code)
    .maybeSingle<{
      result_map: MapKey | null;
      map_bans: MapKey[] | null;
      side_team1: Side | null;
    }>();
  if (error) throw error;
  return {
    map: data?.result_map
      ? { map: data.result_map, bans: data.map_bans ?? [] }
      : null,
    side: data?.side_team1 ?? null,
  };
}
