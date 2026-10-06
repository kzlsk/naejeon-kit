/**
 * valorant-api.com 에서 맵·티어 이미지를 받아 public/ 에 저장한다.
 * 수동 실행용: `npm run fetch-assets` (액트가 바뀌어 맵 풀이 바뀌면 다시 실행)
 * 앱은 public/ 의 정적 파일만 쓰고, 실행 중에는 외부 API 를 호출하지 않는다.
 *
 * - 맵: constants/maps.ts 의 모든 맵 (경쟁전 풀 밖 포함) → public/maps/{key}-list.png, {key}-splash.png
 * - 티어: 최신 시즌 → public/tiers/{tier}.png (largeIcon)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { MAPS, type MapKey } from "../src/lib/constants/maps.ts";
import { TIER_GROUPS } from "../src/lib/constants/tiers.ts";

const API = "https://valorant-api.com/v1";
const PUBLIC_DIR = join(import.meta.dirname, "..", "public");

type ApiMap = {
  displayName: string;
  listViewIcon: string | null;
  splash: string | null;
};

type ApiTier = {
  tier: number;
  tierName: string;
  smallIcon: string | null;
  largeIcon: string | null;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const body = (await res.json()) as { status: number; data: T };
  return body.data;
}

async function download(url: string, file: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(`  ✓ ${file.slice(PUBLIC_DIR.length + 1)}`);
}

/** API tier 번호 → 우리 티어 키. 0 = 언랭, 3~26 = 아이언 1 ~ 불멸 3, 27 = 레디언트 */
function tierKeyOf(tier: number): string | null {
  if (tier === 0) return "unranked";
  if (tier < 3) return null; // 1, 2 = 미사용
  const index = tier - 3;
  const group = TIER_GROUPS[Math.floor(index / 3)];
  if (!group) return null;
  return group.divisions === 1 ? group.key : `${group.key}_${(index % 3) + 1}`;
}

async function fetchMaps() {
  console.log("맵");
  const dir = join(PUBLIC_DIR, "maps");
  await mkdir(dir, { recursive: true });

  const maps = await getJson<ApiMap[]>("/maps?language=ko-KR");
  const byName = new Map(maps.map((m) => [m.displayName, m]));
  const missing: MapKey[] = [];

  for (const key of Object.keys(MAPS) as MapKey[]) {
    const map = byName.get(MAPS[key]);
    if (!map?.listViewIcon || !map.splash) {
      missing.push(key);
      continue;
    }
    await download(map.listViewIcon, join(dir, `${key}-list.png`));
    await download(map.splash, join(dir, `${key}-splash.png`));
  }

  if (missing.length) {
    throw new Error(
      `API 에서 찾지 못한 맵: ${missing.map((k) => `${k}(${MAPS[k]})`).join(", ")} — constants/maps.ts 의 한글 이름을 확인하세요`,
    );
  }
}

async function fetchTiers() {
  console.log("티어");
  const dir = join(PUBLIC_DIR, "tiers");
  await mkdir(dir, { recursive: true });

  const seasons = await getJson<{ tiers: ApiTier[] }[]>(
    "/competitivetiers?language=ko-KR",
  );
  const latest = seasons.at(-1);
  if (!latest) throw new Error("competitivetiers 응답이 비어 있어요");

  const saved = new Set<string>();
  for (const t of latest.tiers) {
    if (!t.smallIcon || !t.largeIcon) continue;
    const key = tierKeyOf(t.tier);
    if (!key) {
      console.warn(
        `  ! 매핑할 수 없는 티어 ${t.tier} (${t.tierName}) — 건너뜀`,
      );
      continue;
    }
    await download(t.largeIcon, join(dir, `${key}.png`));
    saved.add(key);
  }

  const expected = [
    "unranked",
    ...TIER_GROUPS.flatMap((g) =>
      g.divisions === 1 ? [g.key] : [1, 2, 3].map((d) => `${g.key}_${d}`),
    ),
  ];
  const notSaved = expected.filter((k) => !saved.has(k));
  if (notSaved.length) {
    throw new Error(`저장되지 않은 티어: ${notSaved.join(", ")}`);
  }
}

await fetchMaps();
await fetchTiers();
console.log("완료");
