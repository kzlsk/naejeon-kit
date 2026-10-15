# AI 활용 리포트 — 개발

> 환경: 개발(feature/riot-link) · 기준 커밋: `e28af42` · 작성일: 2026-10-08

## 1. 사용한 AI와 역할

| AI | 역할 |
|---|---|
| Claude (채팅) | 라이엇 API · 정책 조사, 기능 범위 결정(타인 검색 포기 등), 최티·전적 규칙 정리, 트래커형 전적 카드 UI 구상, 에러 원인 분석, Claude Code 용 프롬프트 작성 |
| Claude Code | provider 패턴 · mock 구현, 집계 함수, 마이그레이션, 전적 UI · 상세 패널, 테스트, 병합 충돌 해결 |

## 2. 타임라인 (`git log`, feature/riot-link)

| 날짜 | 커밋 | 내용 |
|---|---|---|
| 2026-10-06 ~ 07 | `0b75709` ~ `92abc8e` | 공통 기반 (방 · 멤버 · 팀 · 맵 · 공수, 개인정보처리방침 · `riot.txt`) |
| 2026-10-08 | `b87b229` | 요원 아이콘 · uuid · 포지션 에셋 생성 |
| 2026-10-08 | `17f8afc` | 라이엇 프로필 타입 · provider 패턴 · 가짜 구현 · 기능 플래그 |
| 2026-10-08 | `2db7f51` | 같은 매치 집합으로 전적 · 요원 · 포지션 집계 (`aggregateRiotMatches`) |
| 2026-10-08 | `d9ebca5` | 폼 자동 채우기 (`applyRiotProfile`) — 최티 규칙 |
| 2026-10-08 | `73331d3`, `f4c5640` | 라이엇 컬럼 · RPC 검증 마이그레이션, 멤버 타입 · API |
| 2026-10-08 | `c1e65c4`, `9eb8022`, `20de132` | 연결 버튼 · 동의 화면, 트래커형 전적 카드, 폼 요약 카드 |
| 2026-10-08 | `29626be`, `2322582`, `d827e78` | 멤버 목록 전적 요약, 상세 패널 · URL 선택 · 하단 시트, 화면 연결 |
| 2026-10-08 | `02b8ee1`, `f265906`, `dee03ba` | RSO 콜백 스텁 · 환경변수 예시, PRD F3-11 |
| 2026-10-08 | `219e91b` | 운영 기능(멤버 추가 단순화 · 선수 교체 · 팀 공유 · 코드 복사) 병합 |
| 2026-10-08 | `e28af42` | 기술 노트 |

흐름: 라이엇 API 조사 → 기능 플래그 + provider 패턴(mock) → 최티 규칙 → 전적 지표 → 트래커형 UI → 멤버 목록 · 상세 패널 → 운영 기능 병합.

라이엇 마이그레이션 4개(`20261007`~`20261010`)는 모두 `73331d3` 한 커밋에 들어 있다.

## 3. 프롬프트 전략

| 패턴 | 예 | 효과 |
|---|---|---|
| 기능 플래그 기본 false | `NEXT_PUBLIC_RIOT_LINK_ENABLED` 가 `"true"` 일 때만 버튼 | 심사 중인 사이트에 미완성 기능 비노출 (`src/features/riot/config.ts`) |
| 로컬 · 개발 DB 전용 | "개발 DB 에만 push, 운영은 link 하지 않음" | 운영 DB 오염 방지 |
| 시그니처 호환 | 새 RPC 인자는 `default null` | 옛 클라이언트 호출 유지 |
| 정책 금지 항목 명시 | "MMR/ELO 같은 합산 점수 금지", "팀 짜기에 전적 사용 금지", "라이엇 로고 사용 금지" | 코드 · PRD · 주석에 고정 (`types.ts`, `RiotConnectButton.tsx`) |
| 실제 API 없이 구조 먼저 | provider 인터페이스 + mock (지연 · 실패율 포함) | 승인 전 UI · DB · 에러 화면까지 개발 |
| 같은 집계 경로 강제 | mock 도 `topAgentsAndPositions` 를 거치게 | 판수 불일치 버그 차단 |

## 4. 사람이 결정한 것 vs AI 제안

| 항목 | 결정 | 주체 | 근거 |
|---|---|---|---|
| 타인 Riot ID 검색 | 포기 (본인 RSO 동의만) | 사람 (정책 조사 후) | PRD F3-11, `RiotConsentSheet` |
| 전적 표시 범위 | 같은 방 멤버에게만 | 사람 | 동의 화면 "같은 방 멤버에게 표시됩니다" (PRD F3-11) |
| 최티 규칙 | 기획 설명: 이번 액트 최근 기록 중 최고 · 현티보다 높을 때만. **코드 · PRD: 최티는 건드리지 않음** | 사람 | 확인 필요 (불일치, troubleshooting 13) |
| 지표 범위 | 이번 액트 경쟁전 최근 최대 30판, 5판 미만은 "기록 부족" | 사람 + AI | `STATS_MAX_MATCHES`, `STATS_MIN_MATCHES` |
| 전적을 팀 계산에 미사용 | 유지 | 사람 (정책) | PRD F3-11 |
| provider 패턴 · mock | 채택 | AI 제안 | `17f8afc` |
| 지표 · 요원 · 포지션을 같은 매치 집합으로 | 채택 | AI 제안 (버그 후) | `2db7f51` |
| `wins` 를 DB 에서 선택 키로 | 채택 | AI 제안 (`INVALID_RIOT` 후) | `20261010` |
| 프론트 · DB 키 비교 테스트 | 채택 | AI 제안 | `rpc.test.ts` |

## 5. 검증 방법

| 방법 | 대상 | 결과 |
|---|---|---|
| Vitest | 집계 · mock · 자동 채우기 · 전적 카드 · 상세 패널 규칙 · 화면 | 선언 144개 (21개 파일). `it.each` 포함 실행 174개 통과 (`219e91b` 병합 직후) |
| PGlite RPC 테스트 | `_validate_riot`, `_validate_riot_stats`, 키 비교, 시그니처 호환 | `supabase/tests/rpc.test.ts` (선언 28개) |
| typecheck · lint | 전체 | 병합 후 통과 (`219e91b`) |
| `supabase migration list` | 개발 DB 적용 상태 | 2026-10-08 기준 7개 모두 로컬 = 원격 |
| 수동 확인 | mock 연결 · 카드 표시 | 확인 필요 (기록 없음) |

## 6. 한계와 대응

| 한계 | 사례 | 대응 |
|---|---|---|
| Claude Code 가 DB 실제 상태를 모름 | 마이그레이션 미적용으로 400(`column does not exist`) · 404(`PGRST202`) 반복 | ① 컬럼은 `if not exists`, 시그니처 변경 시 `notify pgrst` ② 마이그레이션 후 바로 개발 DB 에 `db push` 하고 결과 보고하도록 규칙화 ③ 존재하지 않는 방 코드로 RPC 를 호출해 함수·컬럼 존재 확인 |
| SQL Editor 수동 적용 | 이력 불일치, `INVALID_RIOT` 사고 | CLI 적용으로 통일, `migration repair` |
| 실제 Riot API 미검증 | 응답 형식은 문서 기준 타입(`RiotMatch`)으로만 | 승인 후 실제 응답으로 집계 테스트 보강 필요 |
| 정책 해석 | 허용 범위가 애매한 항목 | 보수적으로 (합산 점수 · 팀 계산 사용 금지) |

## 7. 수치 (feature/riot-link @ `e28af42`, 직접 셈)

| 항목 | 값 | 세는 방법 |
|---|---|---|
| 커밋 | 32 | `git rev-list --count HEAD` |
| 테스트 | 선언 144 / 실행 174 (21개 파일) | `it(`·`it.each(` 개수 / vitest (`219e91b`) |
| 마이그레이션 | 7 | `supabase/migrations/*.sql` |
| React 컴포넌트 | 55 (페이지·레이아웃 6 포함) | `export (default)? (async)? function 대문자` (.tsx, 테스트 제외) |
| .tsx 파일 | 37 | 테스트 제외 |
| 라이엇 전용 컴포넌트 | 12 | `src/features/riot/components/*` export |
| Route Handler | 1 (501 스텁) | `src/app/api/riot/callback` |

## 8. 회고

- 잘 된 것: provider 패턴 덕분에 API 승인 전에 UI · DB · 에러 흐름을 끝까지 만들었다. 정책 금지 항목을 코드 주석과 PRD 에 박아 두어 이후 작업에서도 지켜졌다.
- 아쉬운 것: 개발 DB 상태와 마이그레이션 파일이 어긋나는 문제(400/404/42701/`INVALID_RIOT`)에 시간이 많이 들었다. `INVALID_RIOT` 은 아직 화면에서 일반 오류로 보인다.
- 다음: 실제 RSO · Match API 연동, `riot_id` 서버 검증, 최티 규칙 확정, `INVALID_RIOT` 문구 추가.
