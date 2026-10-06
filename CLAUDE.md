@AGENTS.md

# 발로란트 내전 도우미

- 스펙: [docs/PRD.md](docs/PRD.md). 구현은 PRD 기준, PRD와 다른 결정을 하면 PRD도 함께 수정.
- 스택: Next.js 16 (App Router, src/) · TypeScript · Tailwind v4 · TanStack Query · Supabase · Vitest
- 게임 역할은 항상 `position`. 방장/참가자 구분은 `userType`.
- 모든 DB 쓰기는 SECURITY DEFINER RPC로만. 권한 검사는 RPC 안에서. 랜덤도 서버에서만.
- 비밀 값(host_key, edit_token)은 anon SELECT 불가 테이블에.
- 상수는 `src/lib/constants` (TIER_SCORES, POSITIONS, DEFAULT_MAP_POOL 등).

## 명령어
- `npm run dev` / `build` / `lint` / `typecheck`
- `npm test` (vitest run), `npm run test:watch`
- `npm run db:start` (로컬 Supabase, Docker 필요) / `db:reset` (마이그레이션 재적용) / `db:types` (타입 생성)
