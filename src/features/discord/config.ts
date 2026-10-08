/**
 * 디스코드 자동 전송 기능 플래그 (PRD F10). `"true"` 일 때만 UI 와 /api/discord/* 를 연다.
 * NEXT_PUBLIC_* 은 빌드 때 값이 박히므로 바꾸면 다시 빌드해야 한다.
 */
export function isDiscordEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DISCORD_ENABLED === "true";
}

export type DiscordOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** 서버 전용 OAuth 설정. 하나라도 비어 있으면 null */
export function getDiscordOAuthConfig(): DiscordOAuthConfig | null {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
