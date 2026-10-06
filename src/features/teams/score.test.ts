import { describe, expect, it } from "vitest";

import { memberScore } from "./score";

describe("memberScore (PRD §6.2)", () => {
  it("현티 × 0.6 + 최티 × 0.4, 최티가 없으면 현티로 계산", () => {
    expect(memberScore("gold_2", "platinum_1")).toBeCloseTo(
      11 * 0.6 + 13 * 0.4,
    );
    expect(memberScore("gold_2", null)).toBeCloseTo(11);
  });

  it("언랭이면 최티 점수, 미입력이면 null", () => {
    expect(memberScore("unranked", "diamond_1")).toBe(16.5);
    expect(memberScore(null, null)).toBeNull();
  });
});
