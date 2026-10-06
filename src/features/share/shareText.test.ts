import { describe, expect, it } from "vitest";

import { DEMO_TEAMS } from "@/lib/dev/fixtures";

import { buildShareText } from "./shareText";

describe("buildShareText", () => {
  it("맵 · 공수 · 팀을 디코용 텍스트로 만든다", () => {
    const text = buildShareText({
      map: "ascent",
      side: "attack",
      teams: DEMO_TEAMS,
    });
    expect(text.split("\n").slice(0, 6)).toEqual([
      "내전 결과",
      "맵: 어센트",
      "팀1 공격 / 팀2 수비 시작",
      "",
      "[팀1] (68.0)",
      "- 철수 — 타격대 · 주력",
    ]);
    expect(text).toContain("- 준호 — 전략가 · 불가");
    // 역할을 안 고른 멤버는 포지션 없이, 고른 멤버의 자유 칸은 "자유"
    expect(text.split("\n")).toContain("- 서연");
    expect(text).toContain("- 수진 — 자유");
  });

  it("없는 항목은 생략한다", () => {
    expect(buildShareText({ map: null, side: "defense", teams: null })).toBe(
      "내전 결과\n팀1 수비 / 팀2 공격 시작",
    );
  });
});
