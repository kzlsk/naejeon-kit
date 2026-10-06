import { describe, expect, it } from "vitest";

import { formatTier, makeTier, tierDivisionOf, tierGroupOf } from "./tier";

describe("tier helpers", () => {
  it("짧은 이름으로 표시한다", () => {
    expect(formatTier("platinum_1")).toBe("플래티넘 1");
    expect(formatTier("gold_2")).toBe("골드 2");
    expect(formatTier("radiant")).toBe("레디언트");
    expect(formatTier("unranked")).toBe("언랭");
  });

  it("그룹과 단계로 분해·조립한다", () => {
    expect(tierGroupOf("diamond_3")).toBe("diamond");
    expect(tierDivisionOf("diamond_3")).toBe(3);
    expect(tierDivisionOf("radiant")).toBeNull();
    expect(makeTier("diamond", 3)).toBe("diamond_3");
    expect(makeTier("radiant", 2)).toBe("radiant");
    expect(makeTier("unranked", 1)).toBe("unranked");
  });
});
