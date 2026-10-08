import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RpcError } from "@/lib/supabase/rpc";

import { toSendTeams } from "@/features/discord/payload";
import {
  clearWebhook,
  getWebhookForSend,
  readRoomResults,
  setWebhook,
} from "@/features/discord/server/db";
import { OAUTH_COOKIE } from "@/features/discord/server/http";
import { DEMO_MEMBERS } from "@/lib/dev/fixtures";
import type { Member } from "@/features/members/types";
import { generateTeams } from "@/features/teams/generateTeams";

import { GET as callback } from "./callback/route";
import { POST as send } from "./send/route";

vi.mock("@/features/discord/server/db", () => ({
  verifyHost: vi.fn(),
  setWebhook: vi.fn(),
  clearWebhook: vi.fn(),
  getWebhookForSend: vi.fn(),
  readRoomResults: vi.fn(),
}));

const fetchMock = vi.fn<typeof fetch>();
const TEAMS = toSendTeams(
  generateTeams(
    DEMO_MEMBERS.map((m): Member =>
      m.currentTier ? m : { ...m, currentTier: "silver_2" },
    ),
  ),
);
const WEBHOOK = { id: "42", token: "secret-token" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DISCORD_ENABLED", "true");
  vi.stubEnv("DISCORD_CLIENT_ID", "cid");
  vi.stubEnv("DISCORD_CLIENT_SECRET", "csecret");
  vi.stubEnv(
    "DISCORD_REDIRECT_URI",
    "https://example.com/api/discord/callback",
  );
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(getWebhookForSend).mockReset().mockResolvedValue(WEBHOOK);
  vi.mocked(clearWebhook).mockReset().mockResolvedValue(WEBHOOK);
  vi.mocked(setWebhook).mockReset().mockResolvedValue(undefined);
  vi.mocked(readRoomResults)
    .mockReset()
    .mockResolvedValue({ map: { map: "ascent", bans: [] }, side: "attack" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const sendReq = (body: unknown) =>
  new NextRequest("https://example.com/api/discord/send", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("POST /api/discord/send", () => {
  it("방장 키가 틀리면 403, 디스코드로 보내지 않는다", async () => {
    vi.mocked(getWebhookForSend).mockRejectedValue(
      new RpcError("FORBIDDEN", "FORBIDDEN"),
    );
    const res = await send(
      sendReq({ code: "ABC123", hostKey: "wrong", kind: "map" }),
    );
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("teams 스키마가 틀리면 400, 웹훅 조회(전송 횟수)도 하지 않는다", async () => {
    const bad = [
      [TEAMS[0]],
      [
        { ...TEAMS[0], players: [...TEAMS[0].players, TEAMS[1].players[0]] },
        TEAMS[1],
      ],
      [
        {
          ...TEAMS[0],
          players: [{ ...TEAMS[0].players[0], nickname: "x".repeat(40) }],
        },
        TEAMS[1],
      ],
      [
        {
          ...TEAMS[0],
          players: [{ ...TEAMS[0].players[0], position: "healer" }],
        },
        TEAMS[1],
      ],
    ];
    for (const teams of bad) {
      const res = await send(
        sendReq({ code: "ABC123", hostKey: "k", kind: "teams", teams }),
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "INVALID_TEAMS" });
    }
    const missing = await send(
      sendReq({ code: "ABC123", hostKey: "k", kind: "teams" }),
    );
    expect(missing.status).toBe(400);
    expect(getWebhookForSend).not.toHaveBeenCalled();
  });

  it("성공: 웹훅으로 임베드 전송, 응답에 토큰이 없다", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await send(
      sendReq({ code: "abc123", hostKey: "k", kind: "all", teams: TEAMS }),
    );
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain("secret-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://discord.com/api/webhooks/42/secret-token?wait=true",
    );
    const payload = JSON.parse(init!.body as string);
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds.map((e: { title: string }) => e.title)).toEqual([
      "팀 구성",
      "이번 판 맵",
      "공수",
    ]);
    expect(payload.embeds[0].footer.text).toBe("naejeon-kit · 방 코드 ABC123");
  });

  it("디스코드 404 → 연결 해제(clear) 후 DISCORD_DISCONNECTED", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    const res = await send(
      sendReq({ code: "ABC123", hostKey: "k", kind: "side" }),
    );
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "DISCORD_DISCONNECTED" });
    expect(clearWebhook).toHaveBeenCalledWith("ABC123", "k");
  });

  it("디스코드 429 → retry_after 안내", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ retry_after: 2.5 }), { status: 429 }),
    );
    const res = await send(
      sendReq({ code: "ABC123", hostKey: "k", kind: "map" }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "DISCORD_RATE_LIMITED",
      retryAfter: 2.5,
    });
  });

  it("보낼 결과가 없으면 409", async () => {
    vi.mocked(readRoomResults).mockResolvedValue({ map: null, side: null });
    const res = await send(
      sendReq({ code: "ABC123", hostKey: "k", kind: "map" }),
    );
    expect(res.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("기능 플래그가 꺼져 있으면 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_ENABLED", "false");
    const res = await send(
      sendReq({ code: "ABC123", hostKey: "k", kind: "map" }),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/discord/callback", () => {
  const cookie = JSON.stringify({
    state: "s".repeat(48),
    code: "ABC123",
    hostKey: "k",
  });
  const callbackReq = (query: string, withCookie = true) =>
    new NextRequest(`https://example.com/api/discord/callback?${query}`, {
      headers: withCookie
        ? { cookie: `${OAUTH_COOKIE}=${encodeURIComponent(cookie)}` }
        : {},
    });

  const cookieCleared = (res: Response) =>
    /discord_oauth=;.*Max-Age=0/i.test(res.headers.get("set-cookie") ?? "");

  it("state 가 다르면 거부: 토큰 교환·저장 없이 error 로, 쿠키 삭제", async () => {
    const res = await callback(callbackReq("code=c&state=attacker"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://example.com/room/ABC123/host?discord=error",
    );
    expect(cookieCleared(res)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setWebhook).not.toHaveBeenCalled();
  });

  it("쿠키가 없으면 400", async () => {
    const res = await callback(
      callbackReq(`code=c&state=${"s".repeat(48)}`, false),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("사용자가 취소하면 cancelled", async () => {
    const res = await callback(
      callbackReq(`error=access_denied&state=${"s".repeat(48)}`),
    );
    expect(res.headers.get("location")).toMatch(/discord=cancelled$/);
  });

  it("성공: 웹훅·서버 이름만 저장하고 connected 로", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at",
          webhook: { id: "99", token: "wt" },
          guild: { name: "우리 서버" },
        }),
        { status: 200 },
      ),
    );
    const res = await callback(callbackReq(`code=c&state=${"s".repeat(48)}`));
    expect(res.headers.get("location")).toMatch(/discord=connected$/);
    expect(setWebhook).toHaveBeenCalledWith(
      "ABC123",
      "k",
      { id: "99", token: "wt" },
      "우리 서버",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/oauth2/token");
    expect(String(init!.body)).toContain("grant_type=authorization_code");
    expect(cookieCleared(res)).toBe(true);
  });
});
