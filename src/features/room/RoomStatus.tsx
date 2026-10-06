import Link from "next/link";

import { LogoBadge } from "@/components/ui/Logo";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 text-center">
      {children}
    </div>
  );
}

export function RoomLoading() {
  return (
    <Centered>
      <span className="text-muted text-sm" role="status">
        방 불러오는 중…
      </span>
    </Centered>
  );
}

/** 없는 코드 · 만료된 방 (F2-9, PRD §12) */
export function RoomExpired() {
  return (
    <Centered>
      <LogoBadge size={36} />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-bold">만료된 방이에요</h1>
        <p className="text-muted text-sm">
          방은 만든 지 24시간이 지나면 사라져요. 코드도 다시 확인해주세요.
        </p>
      </div>
      <Link
        href="/"
        className="bg-accent text-bg flex h-14 w-full max-w-xs items-center justify-center rounded-xl text-[17px] font-bold"
      >
        처음으로
      </Link>
    </Centered>
  );
}

export function RoomError({ onRetry }: { onRetry: () => void }) {
  return (
    <Centered>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-bold">방을 불러오지 못했어요</h1>
        <p className="text-muted text-sm">연결을 확인하고 다시 시도해주세요.</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="border-line-strong h-11 cursor-pointer rounded-[10px] border px-5 text-sm font-semibold"
      >
        다시 시도
      </button>
    </Centered>
  );
}
