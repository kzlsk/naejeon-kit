import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * 브라우저용 Supabase 클라이언트 (싱글턴).
 * 로그인이 없으므로 anon 키만 사용하고, 모든 쓰기는 RPC로 한다 (PRD §7.3).
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.",
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
