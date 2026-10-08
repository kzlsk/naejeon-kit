/**
 * RSO OAuth 콜백 자리. Production 키 승인 전이라 501 만 돌려준다.
 *
 * TODO(riot): 구현 순서 (자세한 흐름은 src/features/riot/riotProvider.ts)
 *  1. query 의 state 검증 (CSRF nonce, roomCode)
 *  2. code → access token 교환 — RIOT_RSO_CLIENT_ID / RIOT_RSO_CLIENT_SECRET / RIOT_RSO_REDIRECT_URI
 *  3. account/v1/accounts/me → puuid, gameName#tagLine
 *  4. val/match/v1 매치리스트·매치 조회 (RIOT_API_KEY) → 현재 티어, 요원·포지션,
 *     전적 지표를 aggregateRiotMatches 로 한 번에 집계
 *  5. RiotProfile 만 팝업 → opener 로 postMessage 하는 HTML 응답
 *
 *  - API 키와 토큰은 절대 클라이언트로 보내지 않는다 (응답·쿠키·로그 모두).
 *  - 지표를 합친 점수·등급·순위(MMR/ELO 류)는 만들지 않는다 (라이엇 정책).
 */
export async function GET() {
  return Response.json(
    { error: "NOT_IMPLEMENTED", message: "Riot API not approved yet" },
    { status: 501 },
  );
}
