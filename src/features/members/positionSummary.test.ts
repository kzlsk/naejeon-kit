import { describe, expect, it } from "vitest";

import { DEFAULT_POSITIONS } from "@/lib/constants";

import {
  isFreePositions,
  playablePositions,
  positionSummary,
} from "./positionSummary";

describe("positionSummary", () => {
  it("아무것도 안 고르면(전부 가능) 공백", () => {
    expect(isFreePositions(DEFAULT_POSITIONS)).toBe(true);
    expect(positionSummary(DEFAULT_POSITIONS)).toBe("");
    expect(playablePositions(DEFAULT_POSITIONS)).toEqual([]);
  });

  it("주력이 있으면 주력만 보여준다", () => {
    const p = {
      ...DEFAULT_POSITIONS,
      duelist: "main",
      sentinel: "main",
    } as const;
    expect(positionSummary(p)).toBe("타격대 · 감시자");
  });

  it("주력 없이 불가만 있으면 가능한 포지션을 보여준다", () => {
    const p = { ...DEFAULT_POSITIONS, duelist: "no", initiator: "no" } as const;
    expect(isFreePositions(p)).toBe(false);
    expect(positionSummary(p)).toBe("전략가 · 감시자");
  });
});
