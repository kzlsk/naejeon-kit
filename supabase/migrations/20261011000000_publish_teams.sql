-- 팀 결과 공유 (PRD F5-7). 방장이 짠 팀(멤버 id 5명씩)을 rooms 에 저장해서 참가자 화면에 보여준다.
-- 팀 계산은 방장 클라이언트에서 하고(§6, 랜덤 아님), 서버는 구성만 검증한다.

alter table public.rooms
  add column team1_ids uuid[],
  add column team2_ids uuid[];

-- 두 팀 각 5명, 중복 없이, 모두 이 방 멤버. 아니면 INVALID_TEAMS
create function public.set_teams(
  p_code text,
  p_host_key text,
  p_team1 uuid[],
  p_team2 uuid[]
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_room_id uuid := _host_room_id(p_code, p_host_key);
  v_all uuid[] := coalesce(p_team1, '{}') || coalesce(p_team2, '{}');
begin
  if cardinality(p_team1) is distinct from 5
     or cardinality(p_team2) is distinct from 5
     or (select count(distinct id) from unnest(v_all) id) <> 10
     or (select count(*) from members m where m.room_id = v_room_id and m.id = any (v_all)) <> 10 then
    perform _raise('INVALID_TEAMS');
  end if;

  update rooms set team1_ids = p_team1, team2_ids = p_team2 where id = v_room_id;
end $$;

revoke execute on function public.set_teams(text, text, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.set_teams(text, text, uuid[], uuid[]) to anon, authenticated;
