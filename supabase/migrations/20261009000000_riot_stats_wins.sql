-- riot_stats 에 wins(승 판수) 추가 (PRD F3-11). 키 7개로 검증.
-- 함수 시그니처가 같아서 create or replace 로 검증 함수만 바꾼다 (RPC 는 그대로).
-- 이미 저장된 6개 키 행은 그대로 두고, 다음 저장부터 새 형식을 요구한다.

-- { matchCount 1~30 정수, wins 0~matchCount 정수, winRate = wins ÷ matchCount,
--   headshotPct·bodyshotPct·legshotPct 0~1 (합 1, 명중 기록 없으면 전부 0), avgAcs 0~1000 }
create or replace function public._validate_riot_stats(p_riot_id text, p_stats jsonb) returns void
language plpgsql
as $$
declare
  v_shots numeric;
  v_matches int;
  v_wins int;
begin
  if p_stats is null then return; end if;
  if p_riot_id is null
     or jsonb_typeof(p_stats) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_stats)) <> 7
     or exists (
       select 1 from unnest(array[
         'matchCount', 'wins', 'winRate', 'avgAcs', 'headshotPct', 'bodyshotPct', 'legshotPct'
       ]) k
       where jsonb_typeof(p_stats -> k) is distinct from 'number'
     ) then
    perform public._raise('INVALID_RIOT');
  end if;
  if (p_stats ->> 'matchCount') !~ '^\d{1,2}$'
     or (p_stats ->> 'wins') !~ '^\d{1,2}$' then
    perform public._raise('INVALID_RIOT');
  end if;
  v_matches := (p_stats ->> 'matchCount')::int;
  v_wins := (p_stats ->> 'wins')::int;
  if v_matches not between 1 and 30
     or v_wins > v_matches
     or abs((p_stats ->> 'winRate')::numeric - v_wins::numeric / v_matches) > 0.001
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

revoke execute on function public._validate_riot_stats(text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
