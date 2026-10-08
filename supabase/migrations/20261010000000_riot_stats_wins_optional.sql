-- riot_stats.wins 를 선택값으로 (개발 DB 에 직접 반영한 내용과 같음).
-- wins 없이 저장된 예전 행·클라이언트도 통과하고, wins 가 있으면 0 ≤ wins ≤ matchCount 정수.
-- 키 목록은 src/features/riot/types.ts 의 RIOT_STATS_KEYS 와 같아야 한다 (supabase/tests/rpc.test.ts 가 비교).

-- 필수 { matchCount 1~30 정수, winRate·headshotPct·bodyshotPct·legshotPct 0~1, avgAcs 0~1000 }
-- 선택 { wins 0~matchCount 정수 }. 명중 부위 세 값은 합 1 (명중 기록 없으면 전부 0). 그 밖의 키는 거부.
create or replace function public._validate_riot_stats(p_riot_id text, p_stats jsonb) returns void
language plpgsql
as $$
declare
  v_required constant text[] := array['matchCount', 'winRate', 'avgAcs', 'headshotPct', 'bodyshotPct', 'legshotPct'];
  v_optional constant text[] := array['wins'];
  v_matches int;
  v_shots numeric;
begin
  if p_stats is null then return; end if;
  if p_riot_id is null or jsonb_typeof(p_stats) is distinct from 'object' then
    perform public._raise('INVALID_RIOT');
  end if;
  -- 모르는 키 / 필수 키 누락 / 숫자가 아닌 값
  if exists (
       select 1 from jsonb_object_keys(p_stats) k
       where not (k = any (v_required) or k = any (v_optional))
     )
     or exists (
       select 1 from unnest(v_required) k
       where jsonb_typeof(p_stats -> k) is distinct from 'number'
     )
     or (p_stats ? 'wins' and jsonb_typeof(p_stats -> 'wins') is distinct from 'number') then
    perform public._raise('INVALID_RIOT');
  end if;
  if (p_stats ->> 'matchCount') !~ '^\d{1,2}$' then
    perform public._raise('INVALID_RIOT');
  end if;
  v_matches := (p_stats ->> 'matchCount')::int;
  if v_matches not between 1 and 30
     or (p_stats ? 'wins' and (
       (p_stats ->> 'wins') !~ '^\d{1,2}$' or (p_stats ->> 'wins')::int > v_matches
     ))
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

revoke execute on function public._validate_riot_stats(text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
