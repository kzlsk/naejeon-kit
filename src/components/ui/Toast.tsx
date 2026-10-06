"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(durationMs = 1600) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(
    (msg: string) => {
      clearTimeout(timer.current);
      setMessage(msg);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return [message, show] as const;
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center lg:bottom-10"
    >
      {message && (
        <span className="bg-fg text-bg rounded-full px-4 py-2.5 text-sm font-semibold whitespace-nowrap shadow-lg">
          {message}
        </span>
      )}
    </div>
  );
}

/** 클립보드 복사 + 토스트. 실패 시에도 토스트로 알린다. */
export function useCopy() {
  const [message, show] = useToast();
  const copy = useCallback(
    async (text: string, done = "복사했어요") => {
      try {
        await navigator.clipboard.writeText(text);
        show(done);
      } catch {
        show("복사하지 못했어요");
      }
    },
    [show],
  );
  return { toast: message, copy, show };
}
