-- 라이엇 계정 연결 정보 (PRD F3-11). 둘 다 선택값, null = 연결 안 함.
-- 지금은 가짜 데이터(mockProvider)로 클라이언트가 넘긴 값을 저장한다.
-- TODO(riot): 실제 연동 때는 서버가 검증한 값만 저장하도록 바꿔야 "연결됨" 위조를 막을 수 있다.

alter table public.members
  add column riot_id text,
  add column top_agents jsonb;

-- riot_id: "이름#태그" (이름 1~16자, 태그 1~5자 — 형식만 느슨하게). top_agents: [{agent, position, games}] 최대 3개
create function public._validate_riot(p_riot_id text, p_top_agents jsonb) returns void
language plpgsql
as $$
begin
  if p_riot_id is null then
    if p_top_agents is not null then perform public._raise('INVALID_RIOT'); end if;
    return;
  end if;
  if char_length(p_riot_id) > 22 or p_riot_id !~ '^[^#]{1,16}#[^#]{1,5}$' then
    perform public._raise('INVALID_RIOT');
  end if;
  if p_top_agents is null then return; end if;
  if jsonb_typeof(p_top_agents) is distinct from 'array'
     or jsonb_array_length(p_top_agents) > 3
     or exists (
       select 1 from jsonb_array_elements(p_top_agents) a
       where jsonb_typeof(a) is distinct from 'object'
          or (select count(*) from jsonb_object_keys(a)) <> 3
          or jsonb_typeof(a -> 'agent') is distinct from 'string'
          or char_length(a ->> 'agent') not between 1 and 20
          or (a ->> 'position') is null
          or (a ->> 'position') not in ('duelist', 'initiator', 'controller', 'sentinel')
          or jsonb_typeof(a -> 'games') is distinct from 'number'
          or (a ->> 'games') !~ '^\d{1,5}$'
     ) then
    perform public._raise('INVALID_RIOT');
  end if;
end $$;

-- 인자가 늘어 시그니처가 바뀌므로 기존 함수를 지우고 다시 만든다.
-- 새 인자는 default null 이라 예전 클라이언트 호출도 그대로 동작한다 (저장 시 연결 정보는 지워짐).
drop function public.register_self(text, text, text, text, jsonb);
drop function public.update_self(uuid, text, text, text, text, jsonb);
drop function public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb);

create function public.register_self(
  p_code text,
  p_nickname text,
  p_current_tier text,
  p_peak_tier text,
  p_positions jsonb,
  p_riot_id text default null,
  p_top_agents jsonb default null
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

  begin
    insert into members (room_id, nickname, current_tier, peak_tier, positions, riot_id, top_agents)
    values (v_room_id, btrim(p_nickname), p_current_tier, p_peak_tier, p_positions, p_riot_id, p_top_agents)
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
  p_top_agents jsonb default null
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform _check_edit_token(p_member_id, p_edit_token);
  perform _validate_member(p_nickname, p_current_tier, p_peak_tier, p_positions, true);
  perform _validate_riot(p_riot_id, p_top_agents);

  begin
    update members
       set nickname = btrim(p_nickname),
           current_tier = p_current_tier,
           peak_tier = p_peak_tier,
           positions = p_positions,
           riot_id = p_riot_id,
           top_agents = p_top_agents,
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
  p_top_agents jsonb default null
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

  begin
    if p_member_id is null then
      insert into members (room_id, nickname, current_tier, peak_tier, positions, riot_id, top_agents)
      values (v_room_id, btrim(p_nickname), p_current_tier, p_peak_tier, p_positions, p_riot_id, p_top_agents)
      returning id into v_member_id;
    else
      update members
         set nickname = btrim(p_nickname),
             current_tier = p_current_tier,
             peak_tier = p_peak_tier,
             positions = p_positions,
             riot_id = p_riot_id,
             top_agents = p_top_agents,
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
  public._validate_riot(text, jsonb),
  public.register_self(text, text, text, text, jsonb, text, jsonb),
  public.update_self(uuid, text, text, text, text, jsonb, text, jsonb),
  public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb, text, jsonb)
from public, anon, authenticated;

grant execute on function
  public.register_self(text, text, text, text, jsonb, text, jsonb),
  public.update_self(uuid, text, text, text, text, jsonb, text, jsonb),
  public.upsert_member_as_host(text, text, uuid, text, text, text, jsonb, text, jsonb)
to anon, authenticated;
