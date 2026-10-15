# 트러블슈팅 — 개발

> 환경: 개발(feature/riot-link) · 기준 커밋: `e28af42` · 작성일: 2026-10-08
> 출처 표기: **[보고]** 사용자가 직접 겪은 것 (코드 근거 없음) · **[코드]** 커밋·코드·마이그레이션에서 확인 · **[세션]** 개발 대화 중 실제 재현

## DB · 마이그레이션

| # | 문제 | 증상 | 원인 | 해결 | 재발 방지 |
|---|---|---|---|---|---|
| 1 | 개발용 Supabase 프로젝트 분리 후 테이블 없음 **[보고]** | 새 프로젝트에서 방 생성·조회 실패 (메시지 원문 확인 필요) | 새 프로젝트에는 기존 마이그레이션이 없음 | 기존 마이그레이션(`20261006*`)부터 수동 적용 | 프로젝트를 새로 만들면 `supabase/migrations/` 전체를 순서대로 적용 |
| 2 | 새 컬럼 조회 실패 **[보고][코드]** | `400` `column members.riot_stats does not exist` (컬럼명은 상황별) | 프론트(`fetchMembers`)는 새 컬럼을 SELECT 하는데 DB 에 마이그레이션 미적용 | 해당 마이그레이션 적용 | 코드 배포 전에 "앱이 보는 DB" 에 적용됐는지 확인 (아래 9번) |
| 3 | RPC 인자 추가 후 함수 못 찾음 **[보고][코드]** | `404` `PGRST202 Could not find the function public.register_self(...) in the schema cache` | 클라이언트는 `p_riot_id` 등 새 인자로 호출, DB 함수는 옛 시그니처 | `20261008000000_riot_stats.sql` 에서 옛 시그니처 `drop function if exists` 후 재생성 + `notify pgrst, 'reload schema'` | 새 인자는 `default null` 로 → 옛 호출도 동작. 시그니처를 바꾸면 반드시 reload |
| 4 | 마이그레이션 재실행 실패 **[보고][코드]** | `42701 column "riot_stats" of relation "members" already exists` | 이미 수동 적용한 컬럼을 다시 추가 | `add column if not exists riot_stats jsonb` (`20261008`) | 컬럼 추가는 항상 `if not exists`. 함수는 `create or replace` (시그니처 같을 때) |
| 5 | 의존 함수 누락 가능성 **[보고][코드]** | `function public._validate_riot(...) does not exist` (확인 필요) | 앞 마이그레이션(`20261007`)이 중간에 실패하면 `_validate_riot` 없이 뒤 마이그레이션의 RPC 가 생성됨 | 앞 파일부터 다시 적용 | 수동 적용은 파일 전체를 한 번에. 실패하면 거기서 멈추고 원인부터 |
| 6 | 전적 저장 거부 **[보고][코드]** | `P0001 INVALID_RIOT` | 프론트 `RiotStats` 에 `wins` 를 추가했는데 DB 검증은 키 6개만 허용 | `20261009` 에서 7키로, `20261010` 에서 `wins` 를 **선택 키**로 (예전 6키 저장분 허용) | `RIOT_STATS_KEYS`(프론트)와 DB 검증 키를 비교하는 테스트 (`supabase/tests/rpc.test.ts` `it.each(frontendPayloads())`) |
| 7 | SQL Editor 적용과 이력 불일치 **[보고][코드]** | `db push` 가 이미 적용된 파일을 다시 올림 / CLI 가 `Remote migration versions not found in local migrations directory` | SQL Editor 직접 적용은 `supabase_migrations` 이력에 안 남음. `20261010` 파일에 "개발 DB 에 직접 반영한 내용과 같음" 명시 | `supabase migration repair --status applied <버전>` 으로 이력 맞춤 | 개발 DB 는 CLI(`supabase link` → `db push`)로만 적용. link 된 프로젝트 ref 를 push 전에 확인 |
| 8 | link 안 된 상태에서 push 혼선 **[보고]** | push 대상 프로젝트가 의도와 다름 / 실패 | `supabase link` 가 없거나 다른 프로젝트 | push 전에 link 된 프로젝트 확인 후 push | 개발 프로젝트만 link (운영은 link 하지 않음) |
| 9 | 테스트는 통과했는데 화면은 실패 **[보고][세션]** | `npm test` 통과, 브라우저는 400/404 | PGlite 테스트는 **마이그레이션 파일**을 새 DB 에 적용해 검증 → 실제 개발 DB 상태와 별개 | 실제 DB 에 존재하지 않는 방 코드로 RPC 를 호출해 `PGRST202`(함수 없음) / `42703`(컬럼 없음) 확인 | "테스트 통과" ≠ "DB 적용됨". 둘을 따로 확인 |

## 라이엇 연동

| # | 문제 | 증상 | 원인 | 해결 | 재발 방지 |
|---|---|---|---|---|---|
| 10 | 요원 판수 합 > 전체 판수 **[보고][코드]** | 카드의 "이번 액트 최근 N판" 보다 자주 쓴 요원 판수 합이 큼 (구체 수치 확인 필요) | mock 이 지표와 요원을 서로 다른 기준으로 만듦 | 판 수를 먼저 정하고 그 안에서 나누기 + 실제 집계와 같은 `topAgentsAndPositions` 사용 (`2db7f51`, `mockAggregate`). 실제 집계도 같은 매치 집합(`aggregateRiotMatches`) | mock 도 실제 집계 함수를 거친다. `mockProvider.test.ts` 에서 `games 합 ≤ matchCount` 검증 |
| 11 | 라이엇 정책 제약 **[보고][코드]** | 기획한 기능 일부 불가 | ① 남의 Riot ID 검색으로 전적 조회 불가 — 본인이 RSO 로 동의해야 함 ② 지표를 합친 실력 점수(MMR/ELO 류) 금지 ③ 공식 API 로 최고 티어를 정확히 알 수 없음 | ① 본인 연결만 (`RiotConsentSheet`) ② 팀 계산에 전적 미사용, 점수·등급 없음 ③ 최티는 사용자 입력값 유지, 지표는 이번 액트 경쟁전 최근 30판 | 정책 금지 항목을 코드 주석 · PRD 에 명시 (`src/features/riot/types.ts`, PRD F3-11) |
| 12 | `INVALID_RIOT` 이 일반 에러로 표시 **[코드]** | 토스트 "저장하지 못했어요. 잠시 후 다시 시도해주세요" | `src/lib/supabase/rpc.ts` 의 `KNOWN` 목록에 `INVALID_RIOT` 이 없어 `UNKNOWN` 처리 | 미해결 | 새 에러 코드는 `RpcErrorCode`·`KNOWN` 에 같이 추가 |
| 13 | 최티 규칙 불일치 **[코드]** | — | 기획 설명은 "이번 액트 최고 · 현티보다 높을 때만 최티" 인데 코드(`applyRiotProfile`)·PRD 는 "최티 건드리지 않음" | 확인 필요 (어느 쪽이 최종인지) | — |

## 브랜치 · 테스트

| # | 문제 | 증상 | 원인 | 해결 | 재발 방지 |
|---|---|---|---|---|---|
| 14 | 개발 작업이 운영에 섞일 위험 **[보고][코드]** | — | 같은 저장소 · 같은 컴포넌트를 두 브랜치가 수정 | 브랜치 분리(`feature/riot-link`), Supabase 프로젝트 분리, 기능 플래그 `NEXT_PUBLIC_RIOT_LINK_ENABLED` 기본 꺼짐 | 운영 → 개발 방향으로만 병합 (`219e91b`). 운영 반영은 [../README.md](../README.md) 체크리스트 |
| 15 | 병합 후 방장 화면 테스트 전부 실패 **[세션][코드]** | `Error: invariant expected app router to be mounted` / `TypeError: window.matchMedia is not a function` | 병합된 방장 화면이 `useMemberSelection`(`next/navigation`)과 `useIsDesktop`(`matchMedia`)을 씀 → 테스트 환경에 없음 | `HostRoom.test.tsx` 에 `next/navigation` mock, `window.matchMedia` stub (`219e91b`) | URL · 화면폭 훅을 쓰는 컴포넌트 테스트에 같은 mock |
| 16 | 병합 충돌 지점 **[세션][코드]** | `MemberForm`, `TeamCard`, `HostRoom`, `ParticipantRoom`, PRD 충돌 | 운영의 멤버 추가 단순화·선수 교체·팀 공유와 개발의 라이엇 UI 가 같은 파일 수정 | 양쪽 기능 모두 유지하도록 수동 해결 (`219e91b`) | 충돌 많은 파일은 병합 직후 해당 테스트부터 실행 |
