// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RiotConnectButton } from "./RiotConnectButton";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("RiotConnectButton 기능 플래그", () => {
  it.each([undefined, "false", "1", "TRUE"])(
    "NEXT_PUBLIC_RIOT_LINK_ENABLED=%s 이면 렌더하지 않는다",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_RIOT_LINK_ENABLED", value);
      const { container } = render(<RiotConnectButton onClick={() => {}} />);
      expect(container.innerHTML).toBe("");
    },
  );

  it("true 이면 버튼을 보여준다", () => {
    vi.stubEnv("NEXT_PUBLIC_RIOT_LINK_ENABLED", "true");
    render(<RiotConnectButton onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: "라이엇 계정 연결" }),
    ).toBeDefined();
  });
});
