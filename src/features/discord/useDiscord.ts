"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { storageKeys } from "@/lib/constants";
import { readStorage, writeStorage } from "@/lib/storage";

import type { HostAuth } from "@/features/members/api";
import type { TeamResult } from "@/features/teams/types";

import {
  disconnectDiscord,
  sendToDiscord,
  startDiscordConnect,
  type DiscordFailure,
} from "./api";
import { isDiscordEnabled } from "./config";
import type { SendKind } from "./payload";

/** 서버 제한(1분 10회)에 걸렸을 때 안내할 대기 시간 */
const DEFAULT_COOLDOWN_S = 10;

const CONNECT_MESSAGES: Record<string, string> = {
  connected: "디스코드에 연결했어요",
  cancelled: "디스코드 연결을 취소했어요",
  error: "디스코드에 연결하지 못했어요. 다시 시도해주세요",
};

function failureMessage(f: DiscordFailure): string {
  switch (f.error) {
    case "DISCORD_RATE_LIMITED":
      return `디스코드 전송이 너무 잦아요. ${Math.ceil(f.retryAfter ?? DEFAULT_COOLDOWN_S)}초 뒤 다시 시도해주세요`;
    case "DISCORD_DISCONNECTED":
      return "디스코드 채널의 웹훅이 삭제돼 연결이 해제됐어요. 다시 연결해주세요";
    case "DISCORD_NOT_CONNECTED":
      return "디스코드가 연결돼 있지 않아요";
    case "FORBIDDEN":
      return "방장 키가 맞지 않아요";
    case "NOTHING_TO_SEND":
      return "보낼 결과가 없어요";
    case "DISCORD_NOT_CONFIGURED":
      return "디스코드 연동 설정이 아직 안 돼 있어요";
    default:
      return "디스코드로 보내지 못했어요";
  }
}

type AutoKind = Exclude<SendKind, "all">;
/** 팀 · 맵 · 공수가 정해져 있는지 */
export type Decided = { teams: boolean; map: boolean; side: boolean };

/** 자동 전송 설정 (방장 브라우저, 기본 켬) */
function readAuto(code: string): boolean {
  return readStorage(storageKeys.discordAuto(code)) !== "off";
}

type Options = {
  host: HostAuth;
  /** rooms.discord_guild_name — null 이면 연결 안 됨 */
  guildName: string | null;
  toast: (message: string) => void;
  /** 연결 상태가 바뀌었을 수 있을 때 (방 다시 조회) */
  onChanged: () => void;
};

/** 방장 화면 디스코드 연동 상태 · 동작 (PRD F10). 기능 플래그가 꺼져 있으면 enabled=false */
export function useDiscord({ host, guildName, toast, onChanged }: Options) {
  const enabled = isDiscordEnabled();
  const connected = enabled && guildName !== null;
  const [auto, setAutoState] = useState(() => readAuto(host.code));
  // OAuth 콜백에서 돌아온 결과 (?discord=connected|cancelled|error) → 토스트 후 URL 에서 제거
  const handledQuery = useRef(false);
  useEffect(() => {
    if (!enabled || handledQuery.current) return;
    handledQuery.current = true;
    const url = new URL(window.location.href);
    const outcome = url.searchParams.get("discord");
    if (!outcome) return;
    url.searchParams.delete("discord");
    window.history.replaceState(window.history.state, "", url);
    if (CONNECT_MESSAGES[outcome]) toast(CONNECT_MESSAGES[outcome]);
    onChanged();
  }, [enabled, toast, onChanged]);

  const setAuto = (on: boolean) => {
    setAutoState(on);
    writeStorage(storageKeys.discordAuto(host.code), on ? "on" : "off");
  };

  const send = useCallback(
    async (kind: SendKind, teams: TeamResult | null) => {
      if (!connected) return;
      const r = await sendToDiscord(host, kind, teams);
      if (r.ok) {
        toast("디스코드로 보냈어요");
        return;
      }
      toast(failureMessage(r));
      if (r.error === "DISCORD_DISCONNECTED") onChanged();
    },
    [connected, host, toast, onChanged],
  );

  /**
   * 팀 · 맵 · 공수 중 kind 가 새로 정해졌을 때 (연결 + 자동 전송 켜짐일 때만).
   * - 이번 결과로 셋이 처음 다 갖춰지면 → all 로 한 번에
   * - 이미 셋 다 있었으면 → 바뀐 kind 만
   * - 아직 하나라도 없으면 → 보내지 않음
   * teams: 지금(새) 팀 결과, before: 이번 결과가 나오기 전에 정해져 있던 것
   */
  const autoSend = (
    kind: AutoKind,
    teams: TeamResult | null,
    before: Decided,
  ) => {
    const after = { ...before, [kind]: true };
    if (!connected || !auto || !teams || !after.map || !after.side) return;
    const wasComplete = before.teams && before.map && before.side;
    void send(wasComplete ? kind : "all", teams);
  };

  const connect = async () => {
    const r = await startDiscordConnect(host);
    if (r.ok) window.location.assign(r.url);
    else toast(failureMessage(r));
  };

  const disconnect = async () => {
    const r = await disconnectDiscord(host);
    toast(r.ok ? "디스코드 연결을 해제했어요" : failureMessage(r));
    onChanged();
  };

  return {
    enabled,
    connected,
    guildName,
    auto,
    setAuto,
    autoSend,
    connect,
    disconnect,
  };
}

export type DiscordState = ReturnType<typeof useDiscord>;
