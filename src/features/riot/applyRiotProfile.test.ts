import { describe, expect, it } from "vitest";

import { DEFAULT_POSITIONS } from "@/lib/constants";

import {
  applyRiotProfile,
  riotGameName,
  type RiotFillableForm,
} from "./applyRiotProfile";
import type { RiotProfile } from "./types";

const profile: RiotProfile = {
  riotId: "철수#KR1",
  currentTier: "gold_2",
  topAgents: [{ agent: "제트", position: "duelist", games: 30 }],
  topPositions: ["duelist", "initiator"],
  stats: null,
  fetchedAt: "2026-10-07T00:00:00.000Z",
};

const empty: RiotFillableForm = {
  nickname: "",
  currentTier: null,
  peakTier: null,
  positions: DEFAULT_POSITIONS,
};

describe("applyRiotProfile", () => {
  it("빈 폼: 닉네임은 # 앞부분, 현티 채움", () => {
    const r = applyRiotProfile(empty, profile);
    expect(r.nickname).toBe("철수");
    expect(r.currentTier).toBe("gold_2");
  });

  it("닉네임이 이미 있으면 유지 (공백만이면 채움)", () => {
    expect(
      applyRiotProfile({ ...empty, nickname: "디코닉" }, profile).nickname,
    ).toBe("디코닉");
    expect(
      applyRiotProfile({ ...empty, nickname: "  " }, profile).nickname,
    ).toBe("철수");
  });

  it("포지션: 1순위 주력, 2순위 가능, 나머지 기존값", () => {
    const r = applyRiotProfile(
      {
        ...empty,
        positions: {
          duelist: "can",
          initiator: "no",
          controller: "no",
          sentinel: "main",
        },
      },
      profile,
    );
    expect(r.positions).toEqual({
      duelist: "main",
      initiator: "can",
      controller: "no",
      sentinel: "main",
    });
  });

  it("topPositions 가 1개 이하여도 동작", () => {
    expect(
      applyRiotProfile(empty, { ...profile, topPositions: ["sentinel"] })
        .positions,
    ).toEqual({ ...DEFAULT_POSITIONS, sentinel: "main" });
    expect(
      applyRiotProfile(empty, { ...profile, topPositions: [] }).positions,
    ).toEqual(DEFAULT_POSITIONS);
  });

  it("최티는 건드리지 않는다", () => {
    expect(applyRiotProfile(empty, profile).peakTier).toBeNull();
    expect(
      applyRiotProfile({ ...empty, peakTier: "diamond_1" }, profile).peakTier,
    ).toBe("diamond_1");
  });

  it("입력 폼을 바꾸지 않는다", () => {
    const form = { ...empty, positions: { ...DEFAULT_POSITIONS } };
    applyRiotProfile(form, profile);
    expect(form).toEqual({ ...empty, positions: DEFAULT_POSITIONS });
  });
});

describe("riotGameName", () => {
  it("# 앞부분만", () => {
    expect(riotGameName("철수#KR1")).toBe("철수");
    expect(riotGameName("a#b#KR1")).toBe("a#b");
    expect(riotGameName("태그없음")).toBe("태그없음");
  });
});
