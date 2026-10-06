import { describe, expect, it } from "vitest";

import { pruneBans, remainingMaps, toggleBan } from "./bans";

describe("map bans", () => {
  it("최대 2개까지만 밴하고, 다시 탭하면 해제한다", () => {
    let bans = toggleBan([], "ascent");
    bans = toggleBan(bans, "lotus");
    expect(toggleBan(bans, "haven")).toEqual(["ascent", "lotus"]);
    expect(toggleBan(bans, "ascent")).toEqual(["lotus"]);
  });

  it("풀에서 빠진 맵은 밴에서도 빠진다", () => {
    expect(pruneBans(["ascent", "bind"], ["ascent", "haven"])).toEqual([
      "ascent",
    ]);
  });

  it("남은 맵 = 풀 − 밴", () => {
    expect(remainingMaps(["ascent", "haven", "lotus"], ["haven"])).toEqual([
      "ascent",
      "lotus",
    ]);
  });
});
