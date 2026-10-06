-- 방 · 멤버 · 비밀 토큰 + 관련 RPC (PRD §7)
-- 원칙: anon 은 공개 테이블 SELECT 만. 모든 쓰기는 SECURITY DEFINER RPC 로, 권한 검사도 RPC 안에서.

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────── 공개 테이블 ─────────────────────────

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  map_pool text[] not null default array['abyss', 'ascent', 'haven', 'lotus', 'split', 'summit', 'sunset'],
  map_roll_id uuid,
  map_bans text[] not null default '{}',
  result_map text,
  side_roll_id uuid,
  side_team1 text check (side_team1 in ('attack', 'defense')),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  current_tier text,
  peak_tier text,
  positions jsonb not null default '{"duelist":"can","initiator":"can","controller":"can","sentinel":"can"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, nickname)
);

create index members_room_id_idx on public.members (room_id);

alter table public.rooms enable row level security;
alter table public.members enable row level security;

create policy "rooms are readable" on public.rooms for select using (true);
create policy "members are readable" on public.members for select using (true);

-- ─────────────── 비공개 테이블 (RLS 켜고 정책 없음 → anon 접근 전부 차단) ───────────────

create table public.room_secrets (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  host_key text not null
);

create table public.member_tokens (
  member_id uuid primary key references public.members (id) on delete cascade,
  edit_token text not null
);

alter table public.room_secrets enable row level security;
alter table public.member_tokens enable row level security;
revoke all on public.room_secrets, public.member_tokens from anon, authenticated;

-- ───────────────────────── 내부 헬퍼 ─────────────────────────

create function public._new_secret() returns text
language sql volatile
set search_path = public
as $$ select encode(extensions.gen_random_bytes(24), 'hex') $$;

create function public._raise(p_code text) returns void
language plpgsql
as $$ begin raise exception using message = p_code, errcode = 'P0001'; end $$;

-- 티어 키는 src/lib/constants/tiers.ts 의 TIER_SCORES + 'unranked' 와 같아야 한다
create function public._is_tier(p_tier text) returns boolean
language sql immutable
as $$
  select p_tier = any (array[
    'iron_1','iron_2','iron_3','bronze_1','bronze_2','bronze_3',
    'silver_1','silver_2','silver_3','gold_1','gold_2','gold_3',
    'platinum_1','platinum_2','platinum_3','diamond_1','diamond_2','diamond_3',
    'ascendant_1','ascendant_2','ascendant_3','immortal_1','immortal_2','immortal_3',
    'radiant','unranked'
  ])
$$;

-- 멤버 입력 검증 (F3). p_require_tier: 참가자 본인 입력은 현티 필수, 방장 일괄 등록은 미입력 허용
create function public._validate_member(
  p_nickname text,
  p_current_tier text,
  p_peak_tier text,
  p_positions jsonb,
  p_require_tier boolean
) returns void
language plpgsql
as $$
begin
  if p_nickname is null or char_length(btrim(p_nickname)) not between 1 and 16 then
    perform public._raise('INVALID_NICKNAME');
  end if;
  if p_current_tier is null then
    if p_require_tier then perform public._raise('INVALID_TIER'); end if;
  elsif not public._is_tier(p_current_tier) then
    perform public._raise('INVALID_TIER');
  end if;
  if p_peak_tier is not null and (not public._is_tier(p_peak_tier) or p_peak_tier = 'unranked') then
    perform public._raise('INVALID_TIER');
  end if;
  if p_current_tier = 'unranked' and p_peak_tier is null then
    perform public._raise('INVALID_TIER');
  end if;
  if jsonb_typeof(p_positions) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_positions)) <> 4
     or exists (
       select 1 from jsonb_each_text(p_positions) e
       where e.key not in ('duelist', 'initiator', 'controller', 'sentinel')
          or e.value not in ('main', 'can', 'no')
     ) then
    perform public._raise('INVALID_POSITIONS');
  end if;
end $$;

-- 방 코드 + 방장 키 → room_id. 실패 시 ROOM_NOT_FOUND / FORBIDDEN
create function public._host_room_id(p_code text, p_host_key text) returns uuid
language plpgsql
set search_path = public
as $$
declare v_room_id uuid;
begin
  select r.id into v_room_id from rooms r where r.code = upper(p_code);
  if v_room_id is null then perform _raise('ROOM_NOT_FOUND'); end if;
  if not exists (
    select 1 from room_secrets s where s.room_id = v_room_id and s.host_key = p_host_key
  ) then
    perform _raise('FORBIDDEN');
  end if;
  return v_room_id;
end $$;

-- 토큰 일치 확인. 멤버가 없거나 토큰이 다르면 FORBIDDEN (어느 쪽인지 구분하지 않음)
create function public._check_edit_token(p_member_id uuid, p_edit_token text) returns void
language plpgsql
set search_path = public
as $$
begin
  if p_edit_token is null or not exists (
    select 1 from member_tokens t where t.member_id = p_member_id and t.edit_token = p_edit_token
  ) then
    perform _raise('FORBIDDEN');
  end if;
end $$;

-- ───────────────────────── RPC: 방 ─────────────────────────

-- F2-1~F2-3: 코드 생성(충돌 시 최대 5회 재시도) + 방장 키. F2-9: 만료된 방 정리
create function public.create_room() returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_charset constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_room_id uuid;
  v_host_key text := _new_secret();
begin
  delete from rooms where created_at < now() - interval '24 hours';

  for attempt in 1..5 loop
    select string_agg(substr(v_charset, 1 + (get_byte(b, i) % length(v_charset)), 1), '' order by i)
      into v_code
      from (select extensions.gen_random_bytes(6) as b) x, generate_series(0, 5) i;
    begin
      insert into rooms (code) values (v_code) returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_room_id := null;
    end;
  end loop;

  if v_room_id is null then perform _raise('ROOM_CODE_EXHAUSTED'); end if;

  insert into room_secrets (room_id, host_key) values (v_room_id, v_host_key);
  return json_build_object('code', v_code, 'host_key', v_host_key);
end $$;

-- 방장 키 확인용 (F2-8). 틀리면 FORBIDDEN
create function public.verify_host_key(p_code text, p_host_key text) returns void
language plpgsql security definer
set search_path = public
as $$ begin perform _host_room_id(p_code, p_host_key); end $$;

-- ───────────────────────── RPC: 참가자 본인 ─────────────────────────

-- 참가자 신규 등록 → { member_id, edit_token }
create function public.register_self(
  p_code text,
  p_nickname text,
  p_current_tier text,
  p_peak_tier text,
  p_positions jsonb
) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_member_id uuid;
  v_token text := _new_secret();
begin
  select r.id into v_room_id from rooms r where r.code = upper(p_code);
  if v_room_id is null then perform _raise('ROOM_NOT_FOUND'); end if;

  perform _validate_member(p_nickname, p_current_tier, p_peak_tier, p_positions, true);

  begin
    insert into members (room_id, nickname, current_tier, peak_tier, positions)
    values (v_room_id, btrim(p_nickname), p_current_tier, p_peak_tier, p_positions)
    returning id into v_member_id;
  exception when unique_violation then
    perform _raise('NICKNAME_TAKEN');
  end;

  insert into member_tokens (member_id, edit_token) values (v_member_id, v_token);
  return json_build_object('member_id', v_member_id, 'edit_token', v_token);
end $$;

create function public.update_self(
  p_member_id uuid,
  p_edit_token text,
  p_nickname text,
  p_current_tier text,
  p_peak_tier text,
  p_positions jsonb
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform _check_edit_token(p_member_id, p_edit_token);
  perform _validate_member(p_nickname, p_current_tier, p_peak_tier, p_positions, true);

  begin
    update members
       set nickname = btrim(p_nickname),
           current_tier = p_current_tier,
           peak_tier = p_peak_tier,
           positions = p_positions,
           updated_at = now()
     where id = p_member_id;
  exception when unique_violation then
    perform _raise('NICKNAME_TAKEN');
  end;
end $$;

-- member_tokens 는 cascade 로 같이 삭제
create function public.delete_self(p_member_id uuid, p_edit_token text) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform _check_edit_token(p_member_id, p_edit_token);
  delete from members where id = p_member_id;
end $$;

-- ───────────────────────── RPC: 방장 ─────────────────────────

-- p_member_id 가 null 이면 추가, 아니면 수정 → member_id
create function public.upsert_member_as_host(
  p_code text,
  p_host_key text,
  p_member_id uuid,
  p_nickname text,
  p_current_tier text,
  p_peak_tier text,
  p_positions jsonb
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  v_member_id uuid;
begin
  perform _validate_member(p_nickname, p_current_tier, p_peak_tier, p_positions, false);

  begin
    if p_member_id is null then
      insert into members (room_id, nickname, current_tier, peak_tier, positions)
      values (v_room_id, btrim(p_nickname), p_current_tier, p_peak_tier, p_positions)
      returning id into v_member_id;
    else
      update members
         set nickname = btrim(p_nickname),
             current_tier = p_current_tier,
             peak_tier = p_peak_tier,
             positions = p_positions,
             updated_at = now()
       where id = p_member_id and room_id = v_room_id
      returning id into v_member_id;
      if v_member_id is null then perform _raise('MEMBER_NOT_FOUND'); end if;
    end if;
  exception when unique_violation then
    perform _raise('NICKNAME_TAKEN');
  end;

  return v_member_id;
end $$;

-- F3-5: 일괄 등록 → 건너뛴 닉네임 목록
create function public.bulk_add_members(p_code text, p_host_key text, p_nicknames text[])
returns text[]
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  v_name text;
  v_skipped text[] := '{}';
begin
  foreach v_name in array p_nicknames loop
    v_name := btrim(v_name);
    continue when v_name = '' or char_length(v_name) > 16;
    insert into members (room_id, nickname) values (v_room_id, v_name)
    on conflict (room_id, nickname) do nothing;
    if not found then v_skipped := v_skipped || v_name; end if;
  end loop;
  return v_skipped;
end $$;

create function public.delete_member(p_code text, p_host_key text, p_member_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_room_id uuid := _host_room_id(p_code, p_host_key);
begin
  delete from members where id = p_member_id and room_id = v_room_id;
end $$;

-- ───────────────────────── 실행 권한 ─────────────────────────

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.create_room(),
  public.verify_host_key(text, text),
  public.register_self(text, text, text, text, jsonb),
  public.update_self(uuid, text, text, text, text, jsonb),
  public.delete_self(uuid, text),
  public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb),
  public.bulk_add_members(text, text, text[]),
  public.delete_member(text, text, uuid)
to anon, authenticated;

-- ───────────────────────── Realtime ─────────────────────────

-- DELETE 이벤트에 old 레코드(id) 를 싣기 위해
alter table public.members replica identity full;
alter publication supabase_realtime add table public.rooms, public.members;
