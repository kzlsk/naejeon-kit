import { describe, expect, it } from "vitest";

import { DEFAULT_POSITIONS } from "@/lib/constants";
import type { Member } from "@/features/members/types";

import { teamReadiness } from "./readiness";

const member = (i: number, tier: Member["currentTier"] = "gold_1"): Member => ({
  id: String(i),
  nickname: `m${i}`,
  currentTier: tier,
  peakTier: null,
  positions: DEFAULT_POSITIONS,
});

describe("teamReadiness", () => {
  it("10명 + 전원 티어 입력이면 가능", () => {
    expect(
      teamReadiness(Array.from({ length: 10 }, (_, i) => member(i))),
    ).toEqual({
      ready: true,
    });
  });

  it("인원이 10명이 아니면 현재 인원을 알려준다", () => {
    const r = teamReadiness([member(1), member(2)]);
    expect(r).toMatchObject({
      ready: false,
      message: "멤버가 10명이어야 해요 (현재 2명)",
    });
  });

  it("티어 미입력 멤버를 짚어준다", () => {
    const list = Array.from({ length: 10 }, (_, i) =>
      member(i, i === 3 ? null : "gold_1"),
    );
    const r = teamReadiness(list);
    expect(r).toMatchObject({ ready: false, message: "m3 티어 미입력" });
    if (!r.ready) expect(r.missingTier.map((m) => m.id)).toEqual(["3"]);
  });
});
