"use client";

import { useMemo, useSyncExternalStore } from "react";

import { ME_CHANGE_EVENT, parseMe, readMeRaw, type Me } from "./meStorage";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(ME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ME_CHANGE_EVENT, onChange);
  };
}

/**
 * localStorage `member:{code}` 구독.
 * undefined = 아직 모름(서버 렌더), null = 이 기기에서 등록 안 함
 */
export function useMe(code: string): Me | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => readMeRaw(code),
    () => undefined,
  );
  return useMemo(() => (raw === undefined ? undefined : parseMe(raw)), [raw]);
}
