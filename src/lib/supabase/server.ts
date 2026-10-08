import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { RpcError, toRpcErrorCode } from "./rpc";

/**
 * 서버 라우트용 Supabase 클라이언트. 브라우저와 같은 anon 키 — 권한 검사는 RPC 안에서 한다.
 * 요청마다 새로 만든다 (세션 없음).
 */
export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다.",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function serverRpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await getServerSupabase().rpc(fn, args);
  if (error) throw new RpcError(toRpcErrorCode(error.message), error.message);
  return data as T;
}
