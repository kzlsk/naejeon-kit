/**
 * 라이엇 계정 연결 기능 플래그. `"true"` 일 때만 연결 버튼을 보여준다.
 * 프로덕션 기본값은 꺼짐 — 심사 중인 사이트에 미완성 기능을 노출하지 않기 위해.
 * NEXT_PUBLIC_* 은 빌드 때 값이 박히므로 바꾸면 다시 빌드해야 한다.
 */
export function isRiotLinkEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RIOT_LINK_ENABLED === "true";
}
