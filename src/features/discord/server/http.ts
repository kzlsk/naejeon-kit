import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { RpcError } from "@/lib/supabase/rpc";

/** OAuth 진행 중 상태 쿠키 — { state, code, hostKey }. httpOnly, 10분 */
export const OAUTH_COOKIE = "discord_oauth";
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: 600,
  path: "/api/discord",
} as const;

export type HostBody = { code: string; hostKey: string };
export type OAuthState = HostBody & { state: string };

const isHostBody = (v: unknown): v is HostBody => {
  if (typeof v !== "object" || v === null) return false;
  const { code, hostKey } = v as Record<string, unknown>;
  return (
    typeof code === "string" &&
    /^[A-Za-z0-9]{6}$/.test(code) &&
    typeof hostKey === "string" &&
    hostKey.length >= 1 &&
    hostKey.length <= 200
  );
};

/** { code, hostKey } body. 형식이 틀리면 null. 코드는 대문자로 */
export async function readHostBody(req: Request): Promise<HostBody | null> {
  const v: unknown = await req.json().catch(() => null);
  return isHostBody(v)
    ? { code: v.code.toUpperCase(), hostKey: v.hostKey }
    : null;
}

export function parseOAuthCookie(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!isHostBody(v)) return null;
    const state = (v as { state?: unknown }).state;
    return typeof state === "string" && state.length > 0
      ? { state, code: v.code.toUpperCase(), hostKey: v.hostKey }
      : null;
  } catch {
    return null;
  }
}

/** 길이가 다르거나 내용이 다르면 false (상수 시간 비교) */
export function sameState(a: string, b: string | null): boolean {
  if (b === null) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const jsonError = (error: string, status: number, extra = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export const notFound = () => jsonError("NOT_FOUND", 404);

/** RPC 에러 → HTTP 응답 (모르는 에러는 502) */
export function rpcErrorResponse(e: unknown) {
  if (e instanceof RpcError) {
    switch (e.code) {
      case "FORBIDDEN":
        return jsonError("FORBIDDEN", 403);
      case "ROOM_NOT_FOUND":
        return jsonError("ROOM_NOT_FOUND", 404);
      case "DISCORD_NOT_CONNECTED":
        return jsonError("DISCORD_NOT_CONNECTED", 409);
      case "DISCORD_RATE_LIMITED":
        return jsonError("DISCORD_RATE_LIMITED", 429);
    }
  }
  return jsonError("SERVER_ERROR", 502);
}
