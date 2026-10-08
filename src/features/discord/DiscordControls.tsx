"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

import type { DiscordState } from "./useDiscord";

const connectedLabel = (guildName: string | null) =>
  guildName ? `${guildName} 서버 연결됨` : "디스코드 연결됨";

/**
 * 방장 화면 헤더의 디스코드 상태 칩 (PRD F10).
 * 미연결: [디스코드 연결] / 연결됨: "OO 서버 연결됨" → 시트(자동 전송 켜기·끄기, 연결 해제)
 */
export function DiscordChip({ discord }: { discord: DiscordState }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!discord.enabled) return null;

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  if (!discord.connected) {
    return (
      <Button size="sm" disabled={busy} onClick={() => run(discord.connect)}>
        디스코드 연결
      </Button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-line bg-surface text-fg-2 hover:text-fg flex h-9 max-w-[180px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px]"
      >
        <span className="bg-live size-1.5 shrink-0 rounded-full" />
        <span className="truncate">{connectedLabel(discord.guildName)}</span>
      </button>
      <Sheet open={open} title="디스코드" onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-muted text-sm">
            {connectedLabel(discord.guildName)}
          </p>
          <div className="bg-surface flex items-center gap-3 rounded-xl px-4 py-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">자동 전송</span>
              <span className="text-muted text-[13px]">
                팀 · 맵 · 공수가 모두 정해지면 한 번에 보내고, 그 뒤로는 바뀐
                것만 보내요
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={discord.auto}
              aria-label="자동 전송"
              onClick={() => discord.setAuto(!discord.auto)}
              className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${discord.auto ? "bg-accent" : "bg-line-strong"}`}
            >
              <span
                className={`bg-fg absolute top-1 size-5 rounded-full transition-[left] ${discord.auto ? "left-6" : "left-1"}`}
              />
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await discord.disconnect();
                setOpen(false);
              })
            }
            className="text-danger h-11 cursor-pointer text-sm disabled:opacity-50"
          >
            연결 해제
          </button>
        </div>
      </Sheet>
    </>
  );
}
