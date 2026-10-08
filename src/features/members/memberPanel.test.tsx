// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_POSITIONS } from "@/lib/constants";

import { MemberDetailPanel } from "./MemberDetailPanel";
import { memberPanelMode, memberPanelTitle } from "./memberPanel";
import type { Member } from "./types";

afterEach(cleanup);

describe("memberPanelMode — 본인/타인/방장별 버튼 규칙", () => {
  it("참가자 본인: 내 정보 + 버튼", () => {
    const mode = memberPanelMode({
      userType: "participant",
      selectedId: "me",
      meId: "me",
    });
    expect(mode).toMatchObject({
      kind: "me",
      showActions: true,
      showBackToMe: false,
    });
    expect(memberPanelTitle(mode, "철수")).toBe("내 정보");
  });

  it("참가자가 본 다른 멤버: 이름 제목, 버튼 없음, 내 정보로", () => {
    const mode = memberPanelMode({
      userType: "participant",
      selectedId: "u1",
      meId: "me",
    });
    expect(mode).toMatchObject({
      kind: "other",
      showActions: false,
      showBackToMe: true,
    });
    expect(memberPanelTitle(mode, "영희")).toBe("영희");
  });

  it("방장: 누구를 골라도 버튼, 기본은 빈 상태", () => {
    for (const selectedId of ["u1", "u2"]) {
      expect(
        memberPanelMode({ userType: "host", selectedId, meId: null }),
      ).toMatchObject({ kind: "host", showActions: true, showBackToMe: false });
    }
    expect(
      memberPanelMode({ userType: "host", selectedId: null, meId: null }),
    ).toEqual({ kind: "empty" });
  });
});

describe("MemberDetailPanel", () => {
  const m: Member = {
    id: "u1",
    nickname: "영희",
    currentTier: "gold_1",
    peakTier: null,
    positions: DEFAULT_POSITIONS,
  };

  it("방장 빈 상태 안내", () => {
    render(<MemberDetailPanel member={null} title="" />);
    expect(screen.getByText("멤버를 눌러 정보를 확인하세요")).toBeDefined();
  });

  it("방장이 고른 멤버: 이름 제목 + [수정][삭제]", () => {
    render(
      <MemberDetailPanel
        member={m}
        title="영희"
        actions={
          <>
            <button>수정</button>
            <button>삭제</button>
          </>
        }
      />,
    );
    expect(screen.getByRole("heading", { name: "영희" })).toBeDefined();
    expect(screen.getByRole("button", { name: "수정" })).toBeDefined();
    expect(screen.getByRole("button", { name: "삭제" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "← 내 정보로" })).toBeNull();
  });

  it("onClose 를 주면 닫기 버튼 (방장 PC 패널)", () => {
    let closed = false;
    render(
      <MemberDetailPanel
        member={m}
        title="영희"
        onClose={() => (closed = true)}
      />,
    );
    screen.getByRole("button", { name: "상세 닫기" }).click();
    expect(closed).toBe(true);
  });

  it("미연결 멤버: 지표 없이 안내만", () => {
    render(<MemberDetailPanel member={m} title="영희" />);
    expect(screen.getByText("라이엇 계정이 연결되지 않았어요")).toBeDefined();
    expect(screen.queryByText(/승률|ACS/)).toBeNull();
  });
});
