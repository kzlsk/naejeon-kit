import type { RiotProfileProvider } from "./provider";
import { RiotConnectError } from "./types";

/**
 * 실제 라이엇 연동 자리. Production 키 승인 후 구현한다.
 *
 * TODO(riot): 실제 흐름
 *  1. connect() 가 팝업으로 /api/riot/login 을 연다 → RSO 인가 URL 로 리다이렉트
 *     (state 에 roomCode + CSRF nonce)
 *  2. 사용자가 라이엇 로그인·동의 → /api/riot/callback?code=…&state=…
 *  3. 콜백(서버)에서 code → access token 교환 (RIOT_RSO_CLIENT_ID / SECRET)
 *  4. account/v1/accounts/me 로 puuid · Riot ID(gameName#tagLine)
 *  5. val/match/v1 매치리스트 → 최근 경쟁전 매치 조회 (RIOT_API_KEY)
 *  6. aggregateRiotMatches(matches, puuid, { seasonId: 현재 액트 }) 로
 *     지표 · 상위 요원 3개 · 포지션 상위 2개를 같은 매치 집합(이번 액트 경쟁전 최근 30판)에서 한 번에 집계
 *  7. 팝업이 postMessage 로 RiotProfile 만 opener 에 넘기고 닫힘 → connect() resolve
 *
 *  - API 키와 RSO 토큰은 절대 클라이언트로 보내지 않는다. 서버에서 쓰고 버린다.
 *  - 지표를 합친 점수·등급·순위(MMR/ELO 류)는 만들지 않는다 (라이엇 정책).
 *  - 지금은 riot_id 를 클라이언트가 RPC 인자로 넘긴다. 실제 연동 때는 위조된 "연결됨"
 *    뱃지를 막기 위해 서버가 서명한 값(또는 서버가 직접 저장)만 받도록 바꿔야 한다.
 */
export const riotProvider: RiotProfileProvider = {
  async connect() {
    throw new RiotConnectError("not_available", "Riot API not approved yet");
  },
};
