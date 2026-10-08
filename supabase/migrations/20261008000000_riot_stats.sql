-- 라이엇 연결 전적 지표 (PRD F3-11). null = 연결 안 함 또는 집계한 판 없음.
-- 지표를 합친 점수·등급은 저장하지 않고, 팀 짜기에도 쓰지 않는다 (라이엇 정책: MMR/ELO 금지).

alter table public.members add column if not exists riot_stats jsonb;

-- { matchCount 1~30 정수, winRate·headshotPct·bodyshotPct·legshotPct 0~1, avgAcs 0~1000 }
-- 명중 부위 세 값은 합이 1 (명중 기록이 없으면 전부 0). riot_id 없이 지표만 저장할 수 없다.
create or replace function public._validate_riot_stats(p_riot_id text, p_stats jsonb) returns void
language plpgsql
as $$
declare
  v_shots numeric;
begin
  if p_stats is null then return; end if;
  if p_riot_id is null
     or jsonb_typeof(p_stats) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_stats)) <> 6
     or exists (
       select 1 from unnest(array[
         'matchCount', 'winRate', 'avgAcs', 'headshotPct', 'bodyshotPct', 'legshotPct'
       ]) k
       where jsonb_typeof(p_stats -> k) is distinct from 'number'
     ) then
    perform public._raise('INVALID_RIOT');
  end if;
  if (p_stats ->> 'matchCount') !~ '^\d{1,2}$'
     or (p_stats ->> 'matchCount')::int not between 1 and 30
     or (p_stats ->> 'winRate')::numeric not between 0 and 1
     or (p_stats ->> 'avgAcs')::numeric not between 0 and 1000
     or (p_stats ->> 'headshotPct')::numeric not between 0 and 1
     or (p_stats ->> 'bodyshotPct')::numeric not between 0 and 1
     or (p_stats ->> 'legshotPct')::numeric not between 0 and 1 then
    perform public._raise('INVALID_RIOT');
  end if;
  v_shots := (p_stats ->> 'headshotPct')::numeric
           + (p_stats ->> 'bodyshotPct')::numeric
           + (p_stats ->> 'legshotPct')::numeric;
  if v_shots <> 0 and abs(v_shots - 1) > 0.01 then
    perform public._raise('INVALID_RIOT');
  end if;
end $$;

-- 옛 시그니처 정리 (최초 버전 + riot_link 버전)
drop function if exists public.register_self(text, text, text, text, jsonb);
drop function if exists public.register_self(text, text, text, text, jsonb, text, jsonb);
drop function if exists public.update_self(uuid, text, text, text, text, jsonb);
drop function if exists public.update_self(uuid, text, text, text, text, jsonb, text, jsonb);
drop function if exists public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb);
drop function if exists public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb, text, jsonb);

create function public.register_self(
  p_code text,
  p_nickname text,
  p_current_tier text,
  p_peak_tier text,
  p_positions jsonb,
  p_riot_id text default null,
  p_top_agents jsonb default null,
  p_riot_stats jsonb default null
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
  perform _validate_riot(p_riot_id, p_top_agents);
  perform _validate_riot_stats(p_riot_id, p_riot_stats);

  begin
    insert into members (room_id, nickname, current_tier, peak_tier, positions, riot_id, top_agents, riot_stats)
    values (v_room_id, btrim(p_nickname), p_current_tier, p_peak_tier, p_positions, p_riot_id, p_top_agents, p_riot_stats)
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
  p_positions jsonb,
  p_riot_id text default null,
  p_top_agents jsonb default null,
  p_riot_stats jsonb default null
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform _check_edit_token(p_member_id, p_edit_token);
  perform _validate_member(p_nickname, p_current_tier, p_peak_tier, p_positions, true);
  perform _validate_riot(p_riot_id, p_top_agents);
  perform _validate_riot_stats(p_riot_id, p_riot_stats);

  begin
    update members
       set nickname = btrim(p_nickname),
           current_tier = p_current_tier,
           peak_tier = p_peak_tier,
           positions = p_positions,
           riot_id = p_riot_id,
           top_agents = p_top_agents,
           riot_stats = p_riot_stats,
           updated_at = now()
     where id = p_member_id;
  exception when unique_violation then
    perform _raise('NICKNAME_TAKEN');
  end;
end $$;

create function public.upsert_member_as_host(
  p_code text,
  p_host_key text,
  p_member_id uuid,
  p_nickname text,
  p_current_tier text,
  p_peak_tier text,
  p_positions jsonb,
  p_riot_id text default null,
  p_top_agents jsonb default null,
  p_riot_stats jsonb default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  v_member_id uuid;
begin
  perform _validate_member(p_nickname, p_current_tier, p_peak_tier, p_positions, false);
  perform _validate_riot(p_riot_id, p_top_agents);
  perform _validate_riot_stats(p_riot_id, p_riot_stats);

  begin
    if p_member_id is null then
      insert into members (room_id, nickname, current_tier, peak_tier, positions, riot_id, top_agents, riot_stats)
      values (v_room_id, btrim(p_nickname), p_current_tier, p_peak_tier, p_positions, p_riot_id, p_top_agents, p_riot_stats)
      returning id into v_member_id;
    else
      update members
         set nickname = btrim(p_nickname),
             current_tier = p_current_tier,
             peak_tier = p_peak_tier,
             positions = p_positions,
             riot_id = p_riot_id,
             top_agents = p_top_agents,
             riot_stats = p_riot_stats,
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

revoke execute on function
  public._validate_riot_stats(text, jsonb),
  public.register_self(text, text, text, text, jsonb, text, jsonb, jsonb),
  public.update_self(uuid, text, text, text, text, jsonb, text, jsonb, jsonb),
  public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb, text, jsonb, jsonb)
from public, anon, authenticated;

grant execute on function
  public.register_self(text, text, text, text, jsonb, text, jsonb, jsonb),
  public.update_self(uuid, text, text, text, text, jsonb, text, jsonb, jsonb),
  public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb, text, jsonb, jsonb)
to anon, authenticated;

-- PostgREST 가 바뀐 RPC 시그니처를 바로 인식하도록
notify pgrst, 'reload schema';
