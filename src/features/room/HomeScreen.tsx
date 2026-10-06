"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { LogoBadge } from "@/components/ui/Logo";
import {
  DEFAULT_MAP_POOL,
  ROOM_CODE_CHARSET,
  ROOM_CODE_LENGTH,
  storageKeys,
} from "@/lib/constants";
import { writeStorage } from "@/lib/storage";

import { MapImage } from "@/features/map/MapCard";

import { createRoom, fetchRoom } from "./api";

const CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_CHARSET}]{${ROOM_CODE_LENGTH}}$`,
);
const NOT_FOUND = "방을 찾을 수 없어요. 코드를 다시 확인해주세요.";

/** 초기 페이지 — 시안 Main / PcMain (F1) */
export function HomeScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [createError, setCreateError] = useState(false);

  const handleCreate = async () => {
    if (busy) return;
    setBusy("create");
    setCreateError(false);
    try {
      const room = await createRoom();
      writeStorage(storageKeys.hostKey(room.code), room.host_key);
      router.push(`/room/${room.code}/host`);
    } catch (e) {
      console.error("[create_room]", e);
      setCreateError(true);
      setBusy(null);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const normalized = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(normalized)) return setError(NOT_FOUND);
    setBusy("join");
    try {
      if (!(await fetchRoom(normalized))) {
        setError(NOT_FOUND);
        setBusy(null);
        return;
      }
      router.push(`/room/${normalized}`);
    } catch {
      setError("연결이 불안정해요. 잠시 후 다시 시도해주세요.");
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-5 pt-6 pb-8 lg:px-8 lg:pb-0">
        <div className="flex h-11 items-center gap-2.5 lg:h-20">
          <LogoBadge />
          <span className="text-base font-semibold tracking-tight lg:text-[17px]">
            내전 도우미
          </span>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row lg:flex-wrap lg:items-center lg:gap-16 lg:py-12">
          <div className="mt-[120px] flex flex-col gap-3 lg:mt-0 lg:flex-[1_1_420px] lg:gap-5">
            <h1 className="text-[32px] leading-tight font-bold tracking-[-0.8px] lg:text-[56px] lg:tracking-[-1.6px]">
              팀 · 맵 · 공수,
              <br />
              링크 하나로 끝.
            </h1>
            <p className="text-muted text-[15px] leading-relaxed lg:text-lg">
              티어와 포지션까지 보고 5:5를 나눠요.
              <br />
              로그인 없이 방 코드만 공유하면 돼요.
            </p>
          </div>

          <div className="lg:bg-surface mt-auto flex flex-col gap-4 pt-10 lg:mt-0 lg:flex-[0_1_420px] lg:gap-5 lg:rounded-[20px] lg:p-8">
            <Button
              variant="primary"
              size="lg"
              className="w-full lg:h-[60px] lg:text-lg"
              disabled={busy !== null}
              onClick={handleCreate}
            >
              {busy === "create" ? "방 만드는 중…" : "방 파기"}
            </Button>
            {createError && (
              <p className="text-danger -mt-2 text-center text-[13px]">
                방을 만들지 못했어요. 잠시 후 다시 시도해주세요.
              </p>
            )}

            <div className="text-faint flex items-center gap-3 text-[13px]">
              <div className="bg-line lg:bg-surface-strong h-px flex-1" />
              <span>또는 코드로 참가</span>
              <div className="bg-line lg:bg-surface-strong h-px flex-1" />
            </div>

            <form onSubmit={handleJoin} className="flex flex-col gap-2">
              <label htmlFor="code" className="text-muted text-[13px]">
                방 코드
              </label>
              <div className="flex gap-2">
                <input
                  id="code"
                  value={code}
                  maxLength={ROOM_CODE_LENGTH}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="ABC123"
                  aria-invalid={!!error}
                  aria-describedby={error ? "code-error" : undefined}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  className="border-line bg-surface text-fg focus:border-line-strong lg:border-surface-strong lg:bg-bg h-14 min-w-0 flex-1 rounded-xl border px-4 font-mono text-xl tracking-[4px] uppercase outline-none"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="text-base"
                  disabled={busy !== null}
                >
                  참가하기
                </Button>
              </div>
              {error && (
                <p id="code-error" className="text-danger text-[13px]">
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="hidden grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-0.5 opacity-55 lg:grid"
      >
        {DEFAULT_MAP_POOL.slice(0, 6).map((m) => (
          <MapImage key={m} map={m} sizes="17vw" overlay={0} className="h-24" />
        ))}
      </div>
    </div>
  );
}
