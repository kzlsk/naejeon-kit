/** 방 코드 문자셋 — 헷갈리는 0 O 1 I L 제외 (PRD F2-1) */
export const ROOM_CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const NICKNAME_MAX_LENGTH = 16;
export const TEAM_SIZE = 5;
export const PLAYERS_PER_MATCH = TEAM_SIZE * 2;

export const storageKeys = {
  hostKey: (code: string) => `host_key:${code}`,
  memberToken: (code: string) => `member_token:${code}`,
};
