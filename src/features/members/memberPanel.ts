/** 방장/참가자 구분 (features/room 의 UserType 과 같음) */
type UserType = "host" | "participant";

export type MemberPanelMode =
  | { kind: "empty" }
  /** 참가자 본인: "내 정보" + [수정][삭제] */
  | { kind: "me"; showActions: true; showBackToMe: false }
  /** 참가자가 본 다른 멤버: 이름 제목, 버튼 없음, [내 정보로] */
  | { kind: "other"; showActions: false; showBackToMe: true }
  /** 방장: 누구든 [수정][삭제] (방장 권한) */
  | { kind: "host"; showActions: true; showBackToMe: false };

/**
 * 상세 패널의 제목·버튼 규칙. 화면 분기는 표시용이고 실제 권한 검사는 RPC 에서 한다.
 */
export function memberPanelMode({
  userType,
  selectedId,
  meId,
}: {
  userType: UserType;
  selectedId: string | null;
  meId: string | null;
}): MemberPanelMode {
  if (!selectedId) return { kind: "empty" };
  if (userType === "host") {
    return { kind: "host", showActions: true, showBackToMe: false };
  }
  return selectedId === meId
    ? { kind: "me", showActions: true, showBackToMe: false }
    : { kind: "other", showActions: false, showBackToMe: true };
}

export function memberPanelTitle(
  mode: MemberPanelMode,
  nickname: string | undefined,
): string {
  if (mode.kind === "me") return "내 정보";
  return nickname ?? "멤버 정보";
}
