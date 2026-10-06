import { getSupabase } from "./client";

/** RPC 가 `raise exception using message = '<CODE>'` 로 던지는 에러 코드 (supabase/migrations) */
export type RpcErrorCode =
  | "ROOM_NOT_FOUND"
  | "FORBIDDEN"
  | "NICKNAME_TAKEN"
  | "MEMBER_NOT_FOUND"
  | "INVALID_NICKNAME"
  | "INVALID_TIER"
  | "INVALID_POSITIONS"
  | "ROOM_CODE_EXHAUSTED"
  | "UNKNOWN";

const KNOWN = new Set<string>([
  "ROOM_NOT_FOUND",
  "FORBIDDEN",
  "NICKNAME_TAKEN",
  "MEMBER_NOT_FOUND",
  "INVALID_NICKNAME",
  "INVALID_TIER",
  "INVALID_POSITIONS",
  "ROOM_CODE_EXHAUSTED",
]);

export class RpcError extends Error {
  constructor(
    readonly code: RpcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export function toRpcErrorCode(message: string | undefined): RpcErrorCode {
  return message && KNOWN.has(message) ? (message as RpcErrorCode) : "UNKNOWN";
}

export function isRpcError(e: unknown, code: RpcErrorCode): e is RpcError {
  return e instanceof RpcError && e.code === code;
}

export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new RpcError(toRpcErrorCode(error.message), error.message);
  return data as T;
}
