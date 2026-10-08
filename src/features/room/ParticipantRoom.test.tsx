// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_POSITIONS } from "@/lib/constants";

import type { Member } from "@/features/members/types";

import type { Room } from "./api";
import { RegisteredView } from "./ParticipantRoom";

/** next/navigation 대신 메모리 URL — push/replace 하면 구독 중인 훅이 다시 그린다 */
const nav = vi.hoisted(() => {
  let url = new URL("http://test/room/ABC123");
  const listeners = new Set<() => void>();
  return {
    url: () => url,
    go(href: string) {
      url = new URL(href, url);
      listeners.forEach((l) => l());
    },
    reset() {
      url = new URL("http://test/room/ABC123");
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});

vi.mock("next/navigation", async () => {
  const React = await import("react");
  const useUrlPart = (pick: (u: URL) => string) =>
    React.useSyncExternalStore(nav.subscribe, () => pick(nav.url()));
  return {
    useRouter: () => ({ push: nav.go, replace: nav.go }),
    usePathname: () => useUrlPart((u) => u.pathname),
    useSearchParams: () => {
      const search = useUrlPart((u) => u.search);
      return React.useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

/** PC 레이아웃 (왼쪽 패널 있음) */
function setDesktop(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const member = (id: string, nickname: string, extra: Partial<Member> = {}) =>
  ({
    id,
    nickname,
    currentTier: "gold_2",
    peakTier: null,
    positions: DEFAULT_POSITIONS,
    ...extra,
  }) satisfies Member;

const ME = member("me", "철수", {
  riotId: "철수#KR1",
  topAgents: [{ agent: "제트", position: "duelist", games: 12 }],
  riotStats: {
    matchCount: 20,
    wins: 11,
    winRate: 0.55,
    avgAcs: 214,
    headshotPct: 0.2,
    bodyshotPct: 0.7,
    legshotPct: 0.1,
  },
});
const UNLINKED = member("u1", "영희");
const FEW = member("f1", "민수", {
  riotId: "민수#KR2",
  topAgents: [{ agent: "소바", position: "initiator", games: 2 }],
  riotStats: {
    matchCount: 3,
    wins: 1,
    winRate: 1 / 3,
    avgAcs: 180,
    headshotPct: 0.2,
    bodyshotPct: 0.7,
    legshotPct: 0.1,
  },
});

const ROOM: Room = {
  id: "room-1",
  code: "ABC123",
  mapPool: [],
  mapBans: [],
  resultMap: null,
  sideTeam1: null,
} as unknown as Room;

function renderView(members: Member[]) {
  const client = new QueryClient();
  const ui = (list: Member[]) => (
    <QueryClientProvider client={client}>
      <RegisteredView
        room={ROOM}
        members={list}
        me={{ id: ME.id, token: "t" }}
        myMember={ME}
        onLostMe={() => {}}
        onError={() => {}}
        onChanged={() => {}}
      />
    </QueryClientProvider>
  );
  const result = render(ui(members));
  return {
    ...result,
    rerenderWith: (list: Member[]) => result.rerender(ui(list)),
  };
}

/** PC 왼쪽 패널 */
const panel = () => screen.getByRole("complementary");
/** PC 카드 그리드에서 멤버 버튼 (모바일 행과 구분하려고 마지막 것) */
const cardOf = (nickname: string) =>
  screen.getAllByRole("button", { name: new RegExp(nickname) }).at(-1)!;

beforeEach(() => {
  nav.reset();
  setDesktop(true);
});
afterEach(cleanup);

describe("참가자 화면 — 멤버 선택 → 상세 패널", () => {
  it("기본은 본인: 내 정보 + [수정][삭제]", () => {
    renderView([ME, UNLINKED, FEW]);
    expect(
      within(panel()).getByRole("heading", { name: "내 정보" }),
    ).toBeDefined();
    expect(within(panel()).getByRole("button", { name: "수정" })).toBeDefined();
    expect(within(panel()).getByRole("button", { name: "삭제" })).toBeDefined();
    expect(cardOf("철수").getAttribute("aria-pressed")).toBe("true");
  });

  it("다른 멤버를 누르면 패널이 바뀌고, 버튼 없이 [내 정보로]만", () => {
    renderView([ME, UNLINKED, FEW]);
    fireEvent.click(cardOf("영희"));

    expect(nav.url().search).toBe("?member=u1");
    expect(
      within(panel()).getByRole("heading", { name: "영희" }),
    ).toBeDefined();
    expect(within(panel()).queryByRole("button", { name: "수정" })).toBeNull();
    expect(within(panel()).queryByRole("button", { name: "삭제" })).toBeNull();
    expect(
      within(panel()).getByText("라이엇 계정이 연결되지 않았어요"),
    ).toBeDefined();
    expect(cardOf("영희").getAttribute("aria-pressed")).toBe("true");
    expect(cardOf("철수").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(
      within(panel()).getByRole("button", { name: "← 내 정보로" }),
    );
    expect(
      within(panel()).getByRole("heading", { name: "내 정보" }),
    ).toBeDefined();
  });

  it("다른 멤버 상세의 닫기(X) → 내 정보, 본인 상세에는 닫기 없음", () => {
    renderView([ME, UNLINKED, FEW]);
    expect(
      within(panel()).queryByRole("button", { name: "상세 닫기" }),
    ).toBeNull();

    fireEvent.click(cardOf("민수"));
    fireEvent.click(within(panel()).getByRole("button", { name: "상세 닫기" }));
    expect(nav.url().search).toBe("");
    expect(
      within(panel()).getByRole("heading", { name: "내 정보" }),
    ).toBeDefined();
  });

  it("URL ?member= 로 들어오면 그 멤버 (새로고침 유지)", () => {
    nav.go("/room/ABC123?member=f1");
    renderView([ME, UNLINKED, FEW]);
    expect(
      within(panel()).getByRole("heading", { name: "민수" }),
    ).toBeDefined();
  });

  it("선택한 멤버가 삭제되면 본인으로 돌아간다", () => {
    const { rerenderWith } = renderView([ME, UNLINKED, FEW]);
    fireEvent.click(cardOf("민수"));
    expect(
      within(panel()).getByRole("heading", { name: "민수" }),
    ).toBeDefined();

    act(() => rerenderWith([ME, UNLINKED]));
    expect(nav.url().search).toBe("");
    expect(
      within(panel()).getByRole("heading", { name: "내 정보" }),
    ).toBeDefined();
  });
});

describe("멤버 목록 요약 지표", () => {
  it("미연결 멤버 행에는 지표 영역이 없다", () => {
    renderView([ME, UNLINKED, FEW]);
    expect(within(cardOf("영희")).queryByTestId("riot-summary")).toBeNull();
    expect(within(cardOf("영희")).queryByText(/승률|기록 부족|ACS/)).toBeNull();
  });

  it("연결 멤버: 승률·ACS·1순위 요원", () => {
    renderView([ME, UNLINKED, FEW]);
    const summary = within(cardOf("철수")).getByTestId("riot-summary");
    expect(summary.textContent).toContain("55%");
    expect(summary.textContent).toContain("214");
    expect(summary.textContent).toContain("제트");
    expect(summary.textContent).toContain("타격대");
  });

  it("5판 미만: 승률·ACS 대신 기록 부족, 요원은 표시", () => {
    renderView([ME, UNLINKED, FEW]);
    const summary = within(cardOf("민수")).getByTestId("riot-summary");
    expect(summary.textContent).toContain("기록 부족");
    expect(summary.textContent).not.toMatch(/승률|ACS/);
    expect(summary.textContent).toContain("소바");
  });
});

describe("모바일 하단 시트", () => {
  beforeEach(() => setDesktop(false));

  it("행을 누르면 시트, ESC 로 닫힌다", () => {
    renderView([ME, UNLINKED, FEW]);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /영희/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "영희" });
    expect(within(dialog).queryByRole("button", { name: "수정" })).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "닫기" }),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("바깥을 누르면 닫히고, 본인 행이면 [수정][삭제]", () => {
    renderView([ME, UNLINKED, FEW]);
    fireEvent.click(screen.getAllByRole("button", { name: /철수/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "내 정보" });
    expect(within(dialog).getByRole("button", { name: "수정" })).toBeDefined();

    fireEvent.click(screen.getByTestId("bottom-sheet-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
