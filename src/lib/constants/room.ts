/** 방 코드 문자셋 — 헷갈리는 0 O 1 I L 제외 (PRD F2-1) */
export const ROOM_CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const NICKNAME_MAX_LENGTH = 16;
export const TEAM_SIZE = 5;
export const PLAYERS_PER_MATCH = TEAM_SIZE * 2;

export const storageKeys = {
  hostKey: (code: string) => `host_key:${code}`,
  /** 참가자 본인 `{ id, token }` (PRD F3-7) */
  me: (code: string) => `member:${code}`,
  /** 방장 화면 팀 결과 (PRD F5-4) */
  teams: (code: string) => `teams:${code}`,
  /** 방장 화면 디스코드 자동 전송 켜짐 여부 (PRD F10, 기본 켬) */
  discordAuto: (code: string) => `discord_auto:${code}`,
};
