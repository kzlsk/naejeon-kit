// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RiotStats } from "../types";
import { RiotStatsView } from "./RiotStatsView";

afterEach(cleanup);

const STATS: RiotStats = {
  matchCount: 21,
  wins: 12,
  winRate: 12 / 21,
  avgAcs: 214.6,
  headshotPct: 0.234,
  bodyshotPct: 0.706,
  legshotPct: 0.06,
};

describe("RiotStatsView", () => {
  it("5판 미만이면 지표 대신 빈 상태", () => {
    render(
      <RiotStatsView
        stats={{ ...STATS, matchCount: 3, wins: 2, winRate: 2 / 3 }}
      />,
    );
    expect(screen.getByText("이번 액트 기록이 부족해요 (3판)")).toBeDefined();
    expect(screen.queryByText("승률")).toBeNull();
  });

  it("stats 가 없으면 0판으로 빈 상태", () => {
    render(<RiotStatsView stats={null} />);
    expect(screen.getByText("이번 액트 기록이 부족해요 (0판)")).toBeDefined();
  });

  it("승률·명중 %는 소수점 없이, ACS 는 정수, 승패 판수", () => {
    const { container } = render(<RiotStatsView stats={STATS} />);
    expect(screen.getByText("57%")).toBeDefined();
    expect(screen.getByText("12승 9패")).toBeDefined();
    expect(screen.getByText("215")).toBeDefined();
    expect(screen.getByText("라운드당 평균 전투 점수")).toBeDefined();
    // 헤드샷 타일은 없고, 머리 % 는 명중 분포에만
    expect(screen.queryByText("헤드샷")).toBeNull();
    expect(screen.getAllByText("23%")).toHaveLength(1);
    expect(
      screen.getByRole("img", { name: "명중 분포: 머리 23%, 몸 71%, 다리 6%" }),
    ).toBeDefined();
    // 비교·등급 표현 없음
    expect(container.textContent).not.toMatch(/상위|등급|순위|티어 점수/);
  });

  it("승률 50% 기준 색만 은은하게", () => {
    render(<RiotStatsView stats={{ ...STATS, wins: 9, winRate: 9 / 21 }} />);
    expect(screen.getByText("43%").className).toContain("text-danger");
    cleanup();
    render(<RiotStatsView stats={STATS} />);
    expect(screen.getByText("57%").className).toContain("text-live");
  });
});
