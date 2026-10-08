import { NextResponse, type NextRequest } from "next/server";

import {
  getDiscordOAuthConfig,
  isDiscordEnabled,
} from "@/features/discord/config";
import { setWebhook } from "@/features/discord/server/db";
import {
  deleteWebhook,
  exchangeCode,
} from "@/features/discord/server/discordApi";
import {
  notFound,
  OAUTH_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  parseOAuthCookie,
  sameState,
} from "@/features/discord/server/http";

type Outcome = "connected" | "cancelled" | "error";

/**
 * 디스코드 인가 후 돌아오는 곳 (PRD F10). ?code&state 또는 ?error.
 * state 쿠키와 비교 → 토큰 교환 → 웹훅만 저장 → 방장 화면으로.
 * 쿠키는 결과와 상관없이 바로 지운다. 액세스 토큰은 저장하지 않는다.
 */
export async function GET(req: NextRequest) {
  if (!isDiscordEnabled()) return notFound();

  const saved = parseOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  const clearCookie = (res: NextResponse) => {
    res.cookies.set(OAUTH_COOKIE, "", { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  };

  if (!saved) {
    return clearCookie(
      new NextResponse(
        "디스코드 연결 요청이 만료됐어요. 방장 화면에서 다시 시도해주세요.",
        {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      ),
    );
  }

  const back = (outcome: Outcome) =>
    clearCookie(
      NextResponse.redirect(
        new URL(`/room/${saved.code}/host?discord=${outcome}`, req.url),
      ),
    );

  const params = req.nextUrl.searchParams;
  if (!sameState(saved.state, params.get("state"))) return back("error");

  const error = params.get("error");
  if (error) return back(error === "access_denied" ? "cancelled" : "error");

  const code = params.get("code");
  const config = getDiscordOAuthConfig();
  if (!code || !config) return back("error");

  let result;
  try {
    result = await exchangeCode(config, code);
  } catch {
    return back("error");
  }
  try {
    await setWebhook(
      saved.code,
      saved.hostKey,
      result.webhook,
      result.guildName,
    );
  } catch {
    // 저장하지 못한 웹훅은 디스코드에 남기지 않는다
    await deleteWebhook(result.webhook);
    return back("error");
  }
  return back("connected");
}
