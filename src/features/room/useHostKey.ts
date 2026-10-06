"use client";

import { useQuery } from "@tanstack/react-query";

import { storageKeys } from "@/lib/constants";
import { isRpcError } from "@/lib/supabase/rpc";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";

import { verifyHostKey } from "./api";

/** F2-5: `#key=...` 로 들어오면 localStorage 에 저장하고 URL 에서 fragment 제거 */
function takeKeyFromFragment(code: string) {
  const match = window.location.hash.match(/^#key=([0-9a-f]+)$/i);
  if (!match) return;
  writeStorage(storageKeys.hostKey(code), match[1]);
  history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
}

/**
 * 이 기기의 방장 키를 확인한다 (F2-4, F2-5, F2-8).
 * data: 유효한 키 / null(없거나 틀림 → 참가자 화면으로 보내야 함)
 */
export function useHostKey(code: string) {
  return useQuery({
    queryKey: ["host-key", code],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      takeKeyFromFragment(code);
      const key = readStorage(storageKeys.hostKey(code));
      if (!key) return null;
      try {
        await verifyHostKey(code, key);
        return key;
      } catch (e) {
        if (isRpcError(e, "FORBIDDEN") || isRpcError(e, "ROOM_NOT_FOUND")) {
          removeStorage(storageKeys.hostKey(code));
          return null;
        }
        throw e;
      }
    },
  });
}
