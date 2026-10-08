# 기술 노트 — 팀 계산 · 데이터 가공 · 사용 API

> 기능 스펙은 [PRD.md](PRD.md). 이 문서는 **코드가 실제로 어떻게 계산·가공·호출하는지**를 정리한다.
> 기준: 2026-10-08, `main` (`50a15e5`).
> 코드를 바꾸면 이 문서도 같이 고친다.

---

## 1. 팀 짜기 계산

코드: [`src/features/teams/score.ts`](../src/features/teams/score.ts),
[`generateTeams.ts`](../src/features/teams/generateTeams.ts), [`swap.ts`](../src/features/teams/swap.ts),
[`teamPick.ts`](../src/features/teams/teamPick.ts), [`published.ts`](../src/features/teams/published.ts).

**전부 방장 브라우저에서 계산한다** (서버 계산 없음, 랜덤 없음 → 같은 입력이면 항상 같은 결과).

### 1.1 티어 점수표 (`TIER_SCORES`, `src/lib/constants/tiers.ts`)

| 티어       | 1    | 2    | 3    |
| ---------- | ---- | ---- | ---- |
| 아이언     | 1    | 2    | 3    |
| 브론즈     | 4    | 5    | 6    |
| 실버       | 7    | 8    | 9    |
| 골드       | 10   | 11   | 12   |
| 플래티넘   | 13   | 14   | 15   |
| 다이아몬드 | 16.5 | 18   | 19.5 |
| 초월       | 21   | 22.5 | 24   |
| 불멸       | 26   | 28   | 30   |
| 레디언트   | 33   |      |      |

다이아부터 간격이 1 → 1.5 → 2 로 커진다 (상위 티어일수록 실력 차가 크다는 가정).

### 1.2 개인 점수 (`memberScore`)

```
현티 미입력          → null (팀 짜기 불가, 해당 멤버 강조)
현티 = 언랭          → 최티 점수 (언랭이면 최티 필수 — DB 가 검증)
그 외                → 현티 × 0.6 + (최티 ?? 현티) × 0.4
```

가중치는 `CURRENT_TIER_WEIGHT = 0.6`, `PEAK_TIER_WEIGHT = 0.4`.

| 예                 | 계산                | 점수 |
| ------------------ | ------------------- | ---- |
| 골드2, 최티 없음   | 11 × 0.6 + 11 × 0.4 | 11.0 |
| 골드2, 최티 플래1  | 11 × 0.6 + 13 × 0.4 | 11.8 |
| 언랭, 최티 다이아1 | 최티 그대로         | 16.5 |

### 1.3 팀 하나(5명) 평가 — `buildTeam`

1. **포지션 배정**: 5명을 줄 세우는 120가지 순열을 모두 본다. 앞 4명이 타격대 · 척후대 · 전략가 · 감시자
   칸에, 5번째는 `flex`(자유) 칸에 들어간다.
2. 순열마다
   - `missing` = 배정된 사람이 그 포지션을 `no`(불가)로 둔 칸 목록
   - `mains` = 배정된 사람이 그 포지션을 `main`(주력)으로 둔 칸 수
3. **missing 이 가장 적은 것 → 같으면 mains 가 가장 많은 것** 을 고른다. 완전히 같으면 먼저 나온 순열.
4. flex 칸 사람의 추천 포지션 = 본인 `main` 중 첫 번째, 없으면 `can` 중 첫 번째
   (순서: 타격대 → 척후대 → 전략가 → 감시자).
5. 팀 점수 = 5명 개인 점수 합.

표시: `타격대 · 주력`, `전략가 · 불가`(경고색), `자유`. 포지션을 하나도 안 고른 멤버(전부 can)는 공백.
`missing` 이 있으면 "팀2: 전략가 가능 인원 없음" 경고.

### 1.4 10명 → 5:5 조합 순위 — `rankTeamOptions`

1. 멤버 목록 순서상 **첫 번째 멤버를 팀1에 고정**하고 나머지 9명 중 4명을 고른다 → C(9,4) = **126 조합**
   (팀1/팀2 를 뒤집은 같은 조합을 한 번만 보기 위해).
2. 각 조합의 두 팀을 `buildTeam` 과 같은 규칙으로 평가 (같은 5명은 캐시).
3. **비용(cost)** — 낮을수록 좋다:

   ```
   cost = 1000 × (팀1 missing 수 + 팀2 missing 수)
        +   10 × |팀1 점수 − 팀2 점수|
        −    1 × (팀1 mains + 팀2 mains)
   ```

   가중치 `W_MISSING = 1000`, `W_TIER = 10`, `W_MAIN = 1`. 우선순위는
   **① 포지션 구멍 없음 → ② 점수 차 최소 → ③ 주력 포지션 많이** 순이 되도록 크기를 벌려 뒀다.

4. 비용 오름차순 정렬(안정 정렬 → 동률이면 조합 생성 순서) 후 **상위 10개**(`TEAM_OPTION_COUNT`).

### 1.5 [팀 짜기] / [팀 다시 짜기] — `nextTeamPick`

- 멤버 입력 키 = `JSON.stringify([id, 현티, 최티, positions] 목록)`.
- 키가 같으면 상위 10개 중 **다음 순번**(끝나면 처음으로), 다르면 새로 계산해서 1번째.
- 결과는 방장 브라우저 `localStorage["teams:{방코드}"]` 에 `{ key, options, index }` 로 저장 →
  새로고침해도 유지. 화면에는 "N/10번째 조합 · 점수 차 X.X".

### 1.6 선수 교체 — `swapPlayers` / `pickForSwap`

- 서로 다른 팀의 두 명을 맞바꾼 뒤 **두 팀을 `buildTeam` 으로 다시 평가** (점수 · 포지션 · 경고 재계산).
- 같은 팀 선수를 누르면 선택만 바뀌고, 같은 사람을 다시 누르면 해제.
- 교체 결과는 localStorage 에 저장하지 않는다. 대신 아래 1.7 로 DB 에 공유된 구성이 있으면,
  새로고침 때 `restoreSwap` 이 "자동 생성 결과와 같은 10명을 다르게 나눈 것" 인지 보고 교체 결과로 복원.

### 1.7 팀 공유 (참가자 화면) — `teamIdsOf` / `resolveTeams`

- 방장이 팀 짜기 · 교체 · 되돌리기를 할 때, 그리고 방장 화면을 열 때(공유된 것과 다를 때만 1회)
  **멤버 id 만** 서버에 저장한다: `set_teams(code, host_key, team1[5], team2[5])` → `rooms.team1_ids / team2_ids`.
  연속 교체 순서가 뒤집히지 않게 요청을 차례로(Promise 체인) 보낸다.
- 참가자 화면은 그 id 로 **현재 멤버 정보를 찾아 `buildTeam` 으로 다시 평가**해서 보여준다.
  - 멤버가 삭제됐거나 티어가 지워졌으면 `null` → 팀을 숨긴다.
  - 그래서 팀을 짠 뒤 누가 포지션을 고치면 참가자 화면의 추천 포지션은 최신 정보 기준이다
    (방장 화면은 팀을 짠 시점 정보).
- 내 팀 = 내 id 가 들어 있는 팀. 시작 진영 = 팀1 이면 `side_team1`, 팀2 면 그 반대.

### 1.8 디코용 복사 텍스트 — `buildShareText`

```
내전 결과
맵: 어센트                ← 맵 결과 있을 때만
팀1 공격 / 팀2 수비 시작   ← 공수 결과 있을 때만

[팀1] (68.0)              ← 팀 있을 때만, 점수는 소수 1자리
- 철수 — 타격대 · 주력
- 영희                     ← 추천 포지션 표시가 공백이면 닉네임만
```

---

## 2. 서버 랜덤

클라이언트 랜덤 금지. Postgres `random()` 을 RPC 안에서 쓴다
([`20261006010000_map_side_rpc.sql`](../supabase/migrations/20261006010000_map_side_rpc.sql)).

|             | 동작                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `roll_map`  | 맵 풀에서 밴(0~2개, 풀 안, 중복 없음)을 뺀 나머지를 `order by random() limit 1`. 결과·밴·새 `map_roll_id` 저장. 남은 맵이 없으면 `NO_MAPS_LEFT` |
| `roll_side` | `random() < 0.5` 이면 `attack`, 아니면 `defense` → `side_team1` + 새 `side_roll_id`                                                             |

`*_roll_id` 는 결과 연출(룰렛)을 결과마다 한 번만 보여주기 위한 값.

---

## 3. Supabase

클라이언트: [`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) — `@supabase/supabase-js`,
**anon 키만** 사용, 로그인 없음 (`persistSession: false`). 모든 쓰기는 RPC.

환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 3.1 테이블 조회 (PostgREST `GET {URL}/rest/v1/...`)

| 호출                   | 실제 요청                                             | 가공                                                                                                                                           |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchRoom(code)`      | `rooms?select=*&code=eq.{code}`                       | snake_case → camelCase (`rowToRoom`). `team1_ids`·`team2_ids` 가 둘 다 있으면 `teamIds: [팀1, 팀2]`. **생성 24시간 지난 방은 null**(만료 화면) |
| `fetchMembers(roomId)` | `members?select=...&room_id=eq.{id}&order=created_at` | camelCase 변환.                                                                                                                                |

`room_secrets`(host_key), `member_tokens`(edit_token) 은 anon 이 읽을 수 없다 (RLS 정책 없음 + revoke).

### 3.2 RPC (`POST {URL}/rest/v1/rpc/{함수명}`)

전부 `security definer`, 권한 검사는 함수 안에서. 실패는 `raise exception` 메시지 코드 →
클라이언트 `RpcError.code` ([`src/lib/supabase/rpc.ts`](../src/lib/supabase/rpc.ts)).

| 함수                    | 인자                                                           | 권한      | 반환 / 에러                                                                                        |
| ----------------------- | -------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| `create_room`           | —                                                              | 누구나    | `{ code, host_key }`. 코드 6자리(헷갈리는 0/O/1/I/L 제외), 충돌 시 5회 재시도. 24시간 지난 방 삭제 |
| `verify_host_key`       | `p_code, p_host_key`                                           | 누구나    | 틀리면 `FORBIDDEN`                                                                                 |
| `register_self`         | `p_code, p_nickname, p_current_tier, p_peak_tier, p_positions` | 누구나    | `{ member_id, edit_token }` / `ROOM_NOT_FOUND`, `NICKNAME_TAKEN`, `INVALID_*`                      |
| `update_self`           | `p_member_id, p_edit_token`, 멤버 값                           | 본인 토큰 | `FORBIDDEN`, `NICKNAME_TAKEN`                                                                      |
| `delete_self`           | `p_member_id, p_edit_token`                                    | 본인 토큰 | `FORBIDDEN`                                                                                        |
| `upsert_member_as_host` | `p_code, p_host_key, p_member_id(null=추가)`, 멤버 값          | 방장      | `member_id` / `MEMBER_NOT_FOUND`, `NICKNAME_TAKEN`                                                 |
| `delete_member`         | `p_code, p_host_key, p_member_id`                              | 방장      | —                                                                                                  |
| `bulk_add_members`      | `p_code, p_host_key, p_nicknames[]`                            | 방장      | 건너뛴 닉네임 (화면에서 안 씀)                                                                     |
| `set_map_pool`          | `p_code, p_host_key, p_maps[]`                                 | 방장      | `INVALID_MAP_POOL`                                                                                 |
| `roll_map`              | `p_code, p_host_key, p_bans[]`                                 | 방장      | `{ map, roll_id }` / `INVALID_BANS`, `NO_MAPS_LEFT`                                                |
| `roll_side`             | `p_code, p_host_key`                                           | 방장      | `attack` \| `defense`                                                                              |
| `set_teams`             | `p_code, p_host_key, p_team1 uuid[], p_team2 uuid[]`           | 방장      | 각 5명·중복 없음·이 방 멤버가 아니면 `INVALID_TEAMS`                                               |

입력 검증 (DB 쪽):

- 닉네임 공백 제거 후 1~16자, 방 안에서 중복 불가.
- 티어 키는 `tiers.ts` 와 같은 목록. 최티는 `unranked` 불가. 현티가 언랭이면 최티 필수.
  참가자 본인 입력은 현티 필수, 방장 입력은 미입력 허용.
- `positions` 는 4개 키(`duelist`, `initiator`, `controller`, `sentinel`) × `main`/`can`/`no`.

### 3.3 Realtime (`wss://{URL}/realtime/v1/websocket`)

[`src/features/room/queries.ts`](../src/features/room/queries.ts) — 채널 `room:{roomId}`, `postgres_changes` 구독:

| 테이블    | 이벤트         | 필터                         | 처리                                                                             |
| --------- | -------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `members` | INSERT, UPDATE | `room_id=eq.{id}`            | 멤버 목록 다시 조회                                                              |
| `members` | DELETE         | 없음 (DELETE 는 필터 미지원) | 지워진 id 가 캐시에 있을 때만 다시 조회 (`replica identity full` 로 old id 수신) |
| `rooms`   | UPDATE         | `id=eq.{id}`                 | 방 다시 조회 → 맵 · 공수 · **팀 구성** 반영                                      |

구독이 붙은 직후(`SUBSCRIBED`)에도 한 번 다시 조회해서 첫 조회와 구독 사이의 변경을 놓치지 않는다.

---

## 4. valorant-api.com — 이미지 (수동 실행)

[`scripts/fetch-assets.mts`](../scripts/fetch-assets.mts) — `npm run fetch-assets`.
**앱 실행 중에는 호출하지 않는다.** 받은 파일을 `public/` 과 상수 파일로 커밋해서 정적 파일로만 쓴다.
비공식 커뮤니티 API (`https://valorant-api.com/v1`), 키 불필요. 응답은 `{ status, data }` 중 `data` 만 사용.

| 엔드포인트                             | 쓰는 필드                                       | 가공 / 저장                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /maps?language=ko-KR`             | `displayName`, `listViewIcon`, `splash`         | 한글 이름으로 `constants/maps.ts` 의 맵과 매칭 → `public/maps/{key}-list.png`, `{key}-splash.png`. 못 찾은 맵이 있으면 에러                                                 |
| `GET /competitivetiers?language=ko-KR` | 마지막(최신) 시즌의 `tiers[].{tier, largeIcon}` | 티어 번호 → 키: `0` = unranked, `1~2` 미사용, `3~26` = 아이언1~불멸3 (`(tier−3)÷3` 그룹, 나머지+1 단계), `27` = radiant → `public/tiers/{key}.png`. 빠진 티어가 있으면 에러 |

액트가 바뀌어 맵 풀이 바뀌면 다시 실행하고 `src/lib/constants/maps.ts` 의 `DEFAULT_MAP_POOL` 도 갱신.

---

## 5. 브라우저 저장소

| 키                | 내용                                         | 비고                                                                           |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `teams:{code}`    | 방장의 팀 조합 `{ key, options[10], index }` | 1.5                                                                            |
| `host_key:{code}` | 방장 키                                      | 비밀 값. `…/host#key=…` 로 열면 저장된다 (화면의 [방장 링크 복사] 버튼은 없음) |
| `member:{code}`   | 참가자 본인 `{ id, token(edit_token) }`      | 비밀 값. 본인 수정·삭제 권한 증명                                              |

키 이름은 `src/lib/constants/room.ts` 의 `storageKeys`. 시크릿 창 등에서 실패해도 조용히 무시한다 (`src/lib/storage.ts`).

`public/riot.txt` 는 라이엇 앱 심사용 사이트 인증 파일이다.
