import { describe, expect, it } from "vitest";

import { parseNicknames } from "./bulk";

describe("parseNicknames", () => {
  it("빈 줄·앞뒤 공백을 무시하고 중복을 한 번만 남긴다", () => {
    expect(parseNicknames("  철수 \n\n영희\r\n철수\n  \n민수")).toEqual([
      "철수",
      "영희",
      "민수",
    ]);
  });
});
