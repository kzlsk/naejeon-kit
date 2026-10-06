# naejeon-kit

발로란트 내전에서 팀 짜기 · 맵 선택 · 공수 정하기를 링크 하나로 끝내는 웹앱. 스펙은 [docs/PRD.md](docs/PRD.md).

## 시작하기

```bash
npm install
cp .env.example .env.local   # Supabase URL / anon key 입력
npm run dev
```

### 로컬 Supabase (선택, Docker 필요)

```bash
npm run db:start      # 출력된 API URL / anon key를 .env.local에
npm run db:reset      # supabase/migrations 재적용
npm run db:types      # src/lib/supabase/database.types.ts 생성
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` / `typecheck` | ESLint / tsc |
| `npm test` | Vitest |
| `npm run format` | Prettier |
