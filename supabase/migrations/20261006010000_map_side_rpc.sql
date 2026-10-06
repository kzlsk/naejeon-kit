-- 맵 풀 · 맵 랜덤 · 공수 랜덤 RPC (PRD F6, F7, §7.3). 랜덤은 반드시 서버에서.

-- 맵 키는 src/lib/constants/maps.ts 의 MAPS 와 같아야 한다
create function public._is_map_key(p_map text) returns boolean
language sql immutable
as $$
  select p_map = any (array[
    'abyss','ascent','bind','breeze','corrode','fracture','haven',
    'icebox','lotus','pearl','split','summit','sunset'
  ])
$$;

-- F6-1: 맵 풀 저장. 1개 이상, 알려진 맵 키만, 중복 제거
create function public.set_map_pool(p_code text, p_host_key text, p_maps text[]) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_room_id uuid := _host_room_id(p_code, p_host_key);
begin
  if p_maps is null or cardinality(p_maps) = 0
     or exists (select 1 from unnest(p_maps) m where not _is_map_key(m)) then
    perform _raise('INVALID_MAP_POOL');
  end if;
  update rooms
     set map_pool = array(select distinct m from unnest(p_maps) m order by m)
   where id = v_room_id;
end $$;

-- F6-2, F6-3: 밴(0~2개, 맵 풀 안) 을 뺀 나머지 중 랜덤 1개. 누를 때마다 새로 뽑는다
create function public.roll_map(p_code text, p_host_key text, p_bans text[]) returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  v_pool text[];
  v_bans text[] := coalesce(p_bans, '{}');
  v_map text;
  v_roll_id uuid := gen_random_uuid();
begin
  select map_pool into v_pool from rooms where id = v_room_id for update;

  if cardinality(v_bans) > 2
     or cardinality(v_bans) <> (select count(distinct b) from unnest(v_bans) b)
     or not (v_bans <@ v_pool) then
    perform _raise('INVALID_BANS');
  end if;

  select m into v_map
    from unnest(v_pool) m
   where not (m = any (v_bans))
   order by random()
   limit 1;
  if v_map is null then perform _raise('NO_MAPS_LEFT'); end if;

  update rooms
     set map_bans = v_bans, result_map = v_map, map_roll_id = v_roll_id
   where id = v_room_id;

  return json_build_object('map', v_map, 'roll_id', v_roll_id);
end $$;

-- F7-1: 팀1 시작 진영 랜덤. 누를 때마다 새로 뽑는다
create function public.roll_side(p_code text, p_host_key text) returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  v_side text := case when random() < 0.5 then 'attack' else 'defense' end;
begin
  update rooms
     set side_team1 = v_side, side_roll_id = gen_random_uuid()
   where id = v_room_id;
  return v_side;
end $$;

revoke execute on function
  public._is_map_key(text),
  public.set_map_pool(text, text, text[]),
  public.roll_map(text, text, text[]),
  public.roll_side(text, text)
from public, anon, authenticated;

grant execute on function
  public.set_map_pool(text, text, text[]),
  public.roll_map(text, text, text[]),
  public.roll_side(text, text)
to anon, authenticated;
