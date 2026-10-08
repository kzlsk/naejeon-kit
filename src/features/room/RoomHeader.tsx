"use client";

import type { ReactNode } from "react";

import { CopyIcon } from "@/components/ui/icons";
import { LogoBadge } from "@/components/ui/Logo";
import { Toast, useCopy } from "@/components/ui/Toast";

export type UserType = "host" | "participant";

/** 방 코드. 누르면 코드만 클립보드에 복사 (붙여넣기용) */
export function RoomCode({ code }: { code: string }) {
  const { toast, copy } = useCopy();
  return (
    <>
      <button
        type="button"
        aria-label={`방 코드 ${code} 복사`}
        title="눌러서 코드 복사"
        onClick={() => copy(code, "방 코드를 복사했어요")}
        className="hover:bg-surface focus-visible:ring-accent/60 -mx-1.5 flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 outline-none focus-visible:ring-2"
      >
        <span className="font-mono text-lg font-semibold tracking-[2px] lg:text-xl">
          {code}
        </span>
        <CopyIcon size={15} className="text-faint" />
      </button>
      <Toast message={toast} />
    </>
  );
}

export function HostBadge() {
  return (
    <span className="bg-accent-soft text-accent rounded-md px-2 py-0.5 text-xs font-semibold">
      방장
    </span>
  );
}

export function LiveDot({ connected = true }: { connected?: boolean }) {
  return (
    <span className="text-muted flex items-center gap-1.5 text-xs">
      <span
        className={`size-1.5 rounded-full ${connected ? "bg-live" : "bg-faint"}`}
      />
      {connected ? "실시간" : "연결 중…"}
    </span>
  );
}

type RoomHeaderProps = {
  code: string;
  userType: UserType;
  connected?: boolean;
  /** 오른쪽 영역 (버튼들) */
  actions?: ReactNode;
};

/**
 * 방 헤더. 모바일: 코드 + 뱃지 + 오른쪽 액션, PC: 로고와 함께 전체 폭 바.
 * 시안 Host / Participant / PcHost / PcParticipant
 */
export function RoomHeader({
  code,
  userType,
  connected,
  actions,
}: RoomHeaderProps) {
  return (
    <header className="lg:border-line-subtle lg:border-b">
      <div className="mx-auto flex min-h-11 max-w-[1360px] flex-wrap items-center gap-3 lg:min-h-[72px] lg:px-8 lg:py-3.5">
        <div className="mr-auto flex items-center gap-2.5 lg:gap-3">
          <span className="hidden lg:block">
            <LogoBadge />
          </span>
          <RoomCode code={code} />
          {userType === "host" && <HostBadge />}
          <span className={userType === "host" ? "hidden lg:block" : ""}>
            <LiveDot connected={connected} />
          </span>
        </div>
        {actions}
      </div>
    </header>
  );
}
