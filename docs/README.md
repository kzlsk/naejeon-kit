# naejeon-kit 문서

> 기준: 운영 `main` @ `1333baa` · 개발 `feature/riot-link` @ `e28af42` · 작성일 2026-10-08

발로란트 내전용 웹 도구. 방을 만들고 멤버 10명을 모아 5:5 팀 자동 분배, 맵·공수 서버 랜덤, 결과 공유까지 한 화면에서 한다.

- 배포 URL: https://naejeon-kit.vercel.app
- 기능 스펙: [PRD.md](PRD.md) · 디자인 핸드오프: [design-handoff/design-handoff/DESIGN.md](design-handoff/design-handoff/DESIGN.md)

## 문서 목록

| 문서 | 운영 (main) | 개발 (feature/riot-link) |
|---|---|---|
| 기술 스택 · 환경변수 · 아키텍처 · 보안 | [production/tech-stack.md](production/tech-stack.md) | [development/tech-stack.md](development/tech-stack.md) |
| 페이지 · 컴포넌트 · 상태 관리 | [production/components.md](production/components.md) | [development/components.md](development/components.md) |
| DB · RPC · Route Handler · 에러 · 외부 API | [production/api.md](production/api.md) | [development/api.md](development/api.md) |
| 트러블슈팅 | [production/troubleshooting.md](production/troubleshooting.md) | [development/troubleshooting.md](development/troubleshooting.md) |
| AI 활용 리포트 | [production/ai-report.md](production/ai-report.md) | [development/ai-report.md](development/ai-report.md) |

두 폴더는 서로 독립적이다. 개발 문서는 개발 브랜치 코드만 보고 처음부터 끝까지 읽히게 썼다.

## 환경 비교

| 항목 | 운영 | 개발 |
|---|---|---|
| 브랜치 | `main` | `feature/riot-link` (2026-10-08 `main` 의 `50a15e5` 까지 병합, `219e91b`) |
| Supabase 프로젝트 (이름만) | 확인 필요 | `naejeon-kit-riot` (로컬 CLI link 정보 기준) |
| 배포 | Vercel, https://naejeon-kit.vercel.app | 확인 필요 (배포 근거 없음, 로컬 사용) |
| 기능 플래그 | `NEXT_PUBLIC_DISCORD_ENABLED` — 코드 기본값 꺼짐, Vercel 설정값 확인 필요 | `NEXT_PUBLIC_RIOT_LINK_ENABLED` — 코드 기본값 꺼짐, `NEXT_PUBLIC_RIOT_PROVIDER` 기본 `mock` |
| 마이그레이션 파일 | 4개 | 7개 |
| 테스트 | 16개 파일, 실행 110개 | 21개 파일, 선언 144개 (`it.each` 펼치면 실행 174개, `219e91b` 기준) |
| 커밋 수 | 24 | 32 |

## 기능 차이

| 기능 | 운영 | 개발 | 비고 |
|---|---|---|---|
| 방 생성 · 참가 · 멤버 등록 | O | O | |
| 팀 자동 분배 · 다시 짜기(상위 10개 순환) | O | O | |
| 방장 멤버 추가 단순화 ([저장하고 하나 더], 일괄 등록 제거) | O | O | 개발에는 병합으로 들어감 |
| 선수 교체 | O | O | 개발에는 병합으로 들어감 |
| 참가자 화면 팀 결과 · 내 팀 · 시작 진영 | O | O | 개발에는 병합으로 들어감 |
| 방 코드 클릭 복사 | O | O | 개발에는 병합으로 들어감 |
| 디스코드 자동 전송 (OAuth2 웹훅) | O (진행 중) | X | 커밋 완료, 운영 DB 적용·실연결 검증은 확인 필요 |
| [방장 링크 복사] 버튼 | X (제거, `e1ee0a7`) | O | `#key=` 복구 처리는 둘 다 있음 |
| 라이엇 계정 연결 (mock provider) | X | O | 실제 Riot API 호출 없음 |
| 멤버 전적 요약 · 상세 패널 (`?member=`) | X | O | |
| 요원 아이콘 · 요원 표 (`src/lib/constants/agents.ts`) | X | O | |

운영에만 있는 것: 디스코드 자동 전송, [방장 링크 복사] 제거.
개발에만 있는 것: 라이엇 계정 연결(가짜 데이터), 전적 카드·멤버 상세 패널, 요원 에셋.

## 개발 → 운영 반영 체크리스트

| # | 항목 | 확인 내용 |
|---|---|---|
| 1 | 마이그레이션 순서 | 개발의 라이엇 마이그레이션(`20261007`~`20261010`)은 운영에 이미 있는 `20261011`·`20261012` 보다 번호가 앞이다. CLI 로 올리면 `supabase db push --include-all` 이 필요할 수 있다. SQL Editor 로 직접 적용하면 `supabase migration repair --status applied <버전>` 으로 이력을 맞춘다 |
| 2 | RPC 시그니처 | `20261008000000_riot_stats.sql` 은 `register_self` · `update_self` · `upsert_member_as_host` 를 **drop 후 재생성**한다 (새 인자는 `default null`). 운영 원칙 "추가만"과 다르므로, 옛 클라이언트 호출이 그대로 동작하는지 배포 순서를 정해서 확인 |
| 3 | 컬럼 | `members.riot_id` · `top_agents` · `riot_stats` 추가. `add column if not exists` 인지 확인 (`riot_stats` 는 if not exists, `riot_id`·`top_agents` 는 아님) |
| 4 | 개인정보처리방침 | `src/app/privacy/page.tsx` 의 "(예정) 라이엇 계정 연결" 문단을 실제 동작(Riot ID·현재 티어·요원·이번 액트 전적, 같은 방 멤버에게 표시)으로 갱신. 디스코드 문단과 함께 시행일 갱신 |
| 5 | 기능 플래그 | `NEXT_PUBLIC_RIOT_LINK_ENABLED` 는 운영 기본 꺼짐 유지. `NEXT_PUBLIC_*` 는 빌드 때 값이 박히므로 바꾸면 재배포 |
| 6 | 라이엇 승인 범위 | Production 키 승인 전에는 `NEXT_PUBLIC_RIOT_PROVIDER=real` 금지 (`riotProvider` 는 `not_available` 에러만 던짐). 승인된 scope · 표시 범위가 구현(같은 방 멤버에게 전적 표시)과 맞는지 확인 |
| 7 | 서버 전용 키 | `RIOT_API_KEY`, `RIOT_RSO_*` 는 Vercel 서버 환경변수로만. `NEXT_PUBLIC_` 금지 |
| 8 | riot_id 위조 | 지금은 클라이언트가 넘긴 `riot_id` 를 저장한다. 실제 연동 때 서버 검증 값만 저장하도록 바꿔야 함 (PRD F3-11 ⚠️) |
| 9 | 병합 충돌 지점 | 방장 화면(`HostRoom.tsx`)은 운영의 디스코드 칩 · 방장 링크 제거와 개발의 멤버 상세 패널이 겹친다 |
| 10 | 문서 | 개발 브랜치 `docs/TECHNICAL-NOTES.md` 에 Supabase 프로젝트 ref 가 적혀 있다. 운영에 합치기 전에 지울 것 |
