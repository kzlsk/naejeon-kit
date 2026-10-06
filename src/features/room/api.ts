import type { MapKey } from "@/lib/constants";
import { getSupabase } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";

import type { Side } from "@/features/side/side";

/** `rooms` 테이블 한 행 (PRD §7.1) */
export type Room = {
  id: string;
  code: string;
  mapPool: MapKey[];
  mapRollId: string | null;
  mapBans: MapKey[];
  resultMap: MapKey | null;
  sideRollId: string | null;
  sideTeam1: Side | null;
  createdAt: string;
};

type RoomRow = {
  id: string;
  code: string;
  map_pool: MapKey[];
  map_roll_id: string | null;
  map_bans: MapKey[];
  result_map: MapKey | null;
  side_roll_id: string | null;
  side_team1: Side | null;
  created_at: string;
};

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function rowToRoom(r: RoomRow): Room {
  return {
    id: r.id,
    code: r.code,
    mapPool: r.map_pool,
    mapRollId: r.map_roll_id,
    mapBans: r.map_bans,
    resultMap: r.result_map,
    sideRollId: r.side_roll_id,
    sideTeam1: r.side_team1,
    createdAt: r.created_at,
  };
}

/** 없거나 24시간 지난 방이면 null (F2-9) */
export async function fetchRoom(code: string): Promise<Room | null> {
  const { data, error } = await getSupabase()
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle<RoomRow>();
  if (error) throw error;
  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > ROOM_TTL_MS)
    return null;
  return rowToRoom(data);
}

export function createRoom() {
  return callRpc<{ code: string; host_key: string }>("create_room");
}

export function verifyHostKey(code: string, hostKey: string) {
  return callRpc<void>("verify_host_key", {
    p_code: code,
    p_host_key: hostKey,
  });
}

/* ───────── 맵 · 공수 (방장, 랜덤은 서버에서) ───────── */

type HostArgs = { code: string; hostKey: string };

export function setMapPool(host: HostArgs, maps: MapKey[]) {
  return callRpc<void>("set_map_pool", {
    p_code: host.code,
    p_host_key: host.hostKey,
    p_maps: maps,
  });
}

/** 누를 때마다 서버에서 새로 뽑는다 (F6-3) */
export function rollMap(host: HostArgs, bans: MapKey[]) {
  return callRpc<{ map: MapKey; roll_id: string }>("roll_map", {
    p_code: host.code,
    p_host_key: host.hostKey,
    p_bans: bans,
  });
}

/** 누를 때마다 서버에서 새로 뽑는다 (F7-1) */
export function rollSide(host: HostArgs) {
  return callRpc<Side>("roll_side", {
    p_code: host.code,
    p_host_key: host.hostKey,
  });
}
