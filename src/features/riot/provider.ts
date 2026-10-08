import { mockProvider } from "./mockProvider";
import { riotProvider } from "./riotProvider";
import type { RiotProfile } from "./types";

export interface RiotProfileProvider {
  /**
   * RSO 로그인 + 데이터 조회까지. 사용자가 취소하거나 실패하면 RiotConnectError 로 reject.
   * roomCode 는 실제 구현에서 RSO state 에 실어 콜백 후 원래 방으로 돌아오는 데 쓴다.
   */
  connect(roomCode: string): Promise<RiotProfile>;
}

/** `NEXT_PUBLIC_RIOT_PROVIDER=real` 이면 실제 구현, 아니면 가짜 구현 */
export function getRiotProvider(): RiotProfileProvider {
  return process.env.NEXT_PUBLIC_RIOT_PROVIDER === "real"
    ? riotProvider
    : mockProvider;
}
