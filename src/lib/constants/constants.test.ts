import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAP_POOL,
  MAPS,
  ROOM_CODE_CHARSET,
  TIER_GROUPS,
  TIER_SCORES,
} from ".";

describe("constants", () => {
  it("티어 그룹마다 점수표 항목이 있다", () => {
    const keys = TIER_GROUPS.flatMap((g) =>
      g.divisions === 1 ? [g.key] : [1, 2, 3].map((d) => `${g.key}_${d}`),
    );
    expect(keys.sort()).toEqual(Object.keys(TIER_SCORES).sort());
  });

  it("기본 맵 풀은 전체 맵 목록의 부분집합이다", () => {
    for (const m of DEFAULT_MAP_POOL) expect(MAPS).toHaveProperty(m);
  });

  it("방 코드 문자셋에 헷갈리는 문자가 없다", () => {
    expect(ROOM_CODE_CHARSET).not.toMatch(/[0O1IL]/);
  });
});
