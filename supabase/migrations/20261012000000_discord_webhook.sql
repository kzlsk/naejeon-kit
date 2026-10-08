-- 디스코드 자동 전송 (PRD F10). OAuth2 webhook.incoming 으로 받은 채널 웹훅을 방마다 저장한다.
-- 원칙: 기존 컬럼·RPC 는 그대로 두고 추가만. 웹훅 id/token 은 비공개 테이블(room_secrets)에만.
-- 방이 24시간 뒤 삭제되면 room_secrets 도 cascade 로 같이 삭제된다.

-- ───────────────────────── 컬럼 ─────────────────────────

alter table public.room_secrets
  add column if not exists discord_webhook_id text,
  add column if not exists discord_webhook_token text,
  add column if not exists discord_send_window_start timestamptz,
  add column if not exists discord_send_count int default 0;

-- 공개: 방장 화면 "OO 서버 연결됨" 표시용. null = 연결 안 됨, '' = 연결됐지만 서버 이름 모름
alter table public.rooms
  add column if not exists discord_guild_name text;

-- ───────────────────────── RPC ─────────────────────────

-- 방장 키 확인 → boolean (verify_host_key 와 달리 예외 대신 false). 이미 있으면 건드리지 않는다
do $do$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'verify_host'
  ) then
    execute $fn$
      create function public.verify_host(p_code text, p_host_key text) returns boolean
      language sql stable security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from rooms r join room_secrets s on s.room_id = r.id
          where r.code = upper(p_code) and s.host_key = p_host_key
        )
      $body$
    $fn$;
    revoke execute on function public.verify_host(text, text) from public, anon, authenticated;
    grant execute on function public.verify_host(text, text) to anon, authenticated;
  end if;
end
$do$;

-- 웹훅 저장 (OAuth 콜백 서버 라우트에서 호출). 전송 횟수 창도 초기화
create function public.set_discord_webhook(
  p_code text,
  p_host_key text,
  p_webhook_id text,
  p_webhook_token text,
  p_guild_name text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_room_id uuid := _host_room_id(p_code, p_host_key);
begin
  if p_webhook_id is null or p_webhook_id !~ '^[0-9]{1,20}$'
     or p_webhook_token is null or char_length(p_webhook_token) not between 1 and 200
     or char_length(p_guild_name) > 100 then
    perform _raise('INVALID_DISCORD');
  end if;

  update room_secrets
     set discord_webhook_id = p_webhook_id,
         discord_webhook_token = p_webhook_token,
         discord_send_window_start = null,
         discord_send_count = 0
   where room_id = v_room_id;
  update rooms set discord_guild_name = coalesce(btrim(p_guild_name), '') where id = v_room_id;
end $$;

-- 연결 해제 → 지우기 전 { id, token } (없으면 둘 다 null). 서버가 디스코드 쪽 웹훅도 삭제한다
create function public.clear_discord_webhook(p_code text, p_host_key text) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  v_id text;
  v_token text;
begin
  select discord_webhook_id, discord_webhook_token into v_id, v_token
    from room_secrets where room_id = v_room_id for update;

  update room_secrets
     set discord_webhook_id = null,
         discord_webhook_token = null,
         discord_send_window_start = null,
         discord_send_count = 0
   where room_id = v_room_id;
  update rooms set discord_guild_name = null where id = v_room_id;

  return json_build_object('id', v_id, 'token', v_token);
end $$;

-- 전송용 { id, token }. 1분 창마다 최대 10회, 넘으면 DISCORD_RATE_LIMITED. 연결 안 됐으면 DISCORD_NOT_CONNECTED
create function public.get_discord_webhook_for_send(p_code text, p_host_key text) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  s room_secrets%rowtype;
begin
  select * into s from room_secrets where room_id = v_room_id for update;
  if s.discord_webhook_id is null or s.discord_webhook_token is null then
    perform _raise('DISCORD_NOT_CONNECTED');
  end if;

  if s.discord_send_window_start is null
     or s.discord_send_window_start <= now() - interval '1 minute' then
    update room_secrets
       set discord_send_window_start = now(), discord_send_count = 1
     where room_id = v_room_id;
  elsif coalesce(s.discord_send_count, 0) >= 10 then
    perform _raise('DISCORD_RATE_LIMITED');
  else
    update room_secrets
       set discord_send_count = coalesce(discord_send_count, 0) + 1
     where room_id = v_room_id;
  end if;

  return json_build_object('id', s.discord_webhook_id, 'token', s.discord_webhook_token);
end $$;

revoke execute on function
  public.set_discord_webhook(text, text, text, text, text),
  public.clear_discord_webhook(text, text),
  public.get_discord_webhook_for_send(text, text)
from public, anon, authenticated;

grant execute on function
  public.set_discord_webhook(text, text, text, text, text),
  public.clear_discord_webhook(text, text),
  public.get_discord_webhook_for_send(text, text)
to anon, authenticated;

notify pgrst, 'reload schema';
