import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_POSITIONS, type Tier } from "@/lib/constants";
import type { Member } from "@/features/members/types";

import { loadTeamPick, nextTeamPick, saveTeamPick } from "./teamPick";

const tiers: Tier[] = [
  "gold_1",
  "gold_2",
  "gold_3",
  "silver_1",
  "silver_2",
  "platinum_1",
  "platinum_2",
  "bronze_3",
  "diamond_1",
  "iron_3",
];
const members: Member[] = tiers.map((t, i) => ({
  id: String(i),
  nickname: `m${i}`,
  currentTier: t,
  peakTier: null,
  positions: DEFAULT_POSITIONS,
}));

describe("teamPick", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });

  it("저장한 팀은 다시 불러오면(새로고침) 그대로다", () => {
    const pick = nextTeamPick(null, members);
    saveTeamPick("ABC234", pick);
    expect(loadTeamPick("ABC234")).toEqual(pick);
    expect(loadTeamPick("OTHER2")).toBeNull();
  });

  it("다시 짜기를 눌러야만 다음 조합으로 바뀐다", () => {
    const first = nextTeamPick(null, members);
    const second = nextTeamPick(first, members);
    expect(second.index).toBe(1);
    expect(second.options).toBe(first.options);
  });

  it("멤버가 바뀌었으면 다음 클릭에서 처음부터 새로 계산한다", () => {
    const first = nextTeamPick(nextTeamPick(null, members), members);
    const changed = members.map((m, i) =>
      i === 0 ? { ...m, currentTier: "radiant" as const } : m,
    );
    const next = nextTeamPick(first, changed);
    expect(next.index).toBe(0);
    expect(next.key).not.toBe(first.key);
  });

  it("깨진 저장값은 무시한다", () => {
    localStorage.setItem("teams:ABC234", "{oops");
    expect(loadTeamPick("ABC234")).toBeNull();
    localStorage.setItem("teams:ABC234", '{"key":"x","options":[],"index":0}');
    expect(loadTeamPick("ABC234")).toBeNull();
  });
});
