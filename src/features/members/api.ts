import type { PositionProficiency, Tier } from "@/lib/constants";
import { getSupabase } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";

import type { Me } from "./meStorage";
import type { Member, MemberInput } from "./types";

type MemberRow = {
  id: string;
  nickname: string;
  current_tier: Tier | null;
  peak_tier: Tier | null;
  positions: PositionProficiency;
};

export function rowToMember(r: MemberRow): Member {
  return {
    id: r.id,
    nickname: r.nickname,
    currentTier: r.current_tier,
    peakTier: r.peak_tier,
    positions: r.positions,
  };
}

export async function fetchMembers(roomId: string): Promise<Member[]> {
  const { data, error } = await getSupabase()
    .from("members")
    .select("id, nickname, current_tier, peak_tier, positions")
    .eq("room_id", roomId)
    .order("created_at")
    .overrideTypes<MemberRow[], { merge: false }>();
  if (error) throw error;
  return data.map(rowToMember);
}

const memberArgs = (m: MemberInput) => ({
  p_nickname: m.nickname,
  p_current_tier: m.currentTier,
  p_peak_tier: m.peakTier,
  p_positions: m.positions,
});

/* ───────── 참가자 본인 (토큰으로 권한 확인) ───────── */

export async function registerSelf(
  code: string,
  input: MemberInput,
): Promise<Me> {
  const r = await callRpc<{ member_id: string; edit_token: string }>(
    "register_self",
    { p_code: code, ...memberArgs(input) },
  );
  return { id: r.member_id, token: r.edit_token };
}

export function updateSelf(me: Me, input: MemberInput) {
  return callRpc<void>("update_self", {
    p_member_id: me.id,
    p_edit_token: me.token,
    ...memberArgs(input),
  });
}

export function deleteSelf(me: Me) {
  return callRpc<void>("delete_self", {
    p_member_id: me.id,
    p_edit_token: me.token,
  });
}

/* ───────── 방장 (방장 키로 권한 확인) ───────── */

export type HostAuth = { code: string; hostKey: string };

const hostArgs = (h: HostAuth) => ({ p_code: h.code, p_host_key: h.hostKey });

/** memberId 가 없으면 추가 */
export function upsertMemberAsHost(
  host: HostAuth,
  input: MemberInput,
  memberId?: string,
) {
  return callRpc<string>("upsert_member_as_host", {
    ...hostArgs(host),
    p_member_id: memberId ?? null,
    ...memberArgs(input),
  });
}

export function deleteMember(host: HostAuth, memberId: string) {
  return callRpc<void>("delete_member", {
    ...hostArgs(host),
    p_member_id: memberId,
  });
}
