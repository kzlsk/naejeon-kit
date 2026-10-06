import { storageKeys } from "@/lib/constants";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";

/** 이 기기에서 등록한 참가자 본인 (F3-7). token 은 update_self / delete_self 권한 증명용 */
export type Me = { id: string; token: string };

/** 같은 탭 안에서 setMe/clearMe 를 구독자에게 알리는 이벤트 (다른 탭은 `storage` 이벤트) */
export const ME_CHANGE_EVENT = "naejeon:me-change";

export function parseMe(raw: string | null): Me | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Me>;
    return typeof v.id === "string" && typeof v.token === "string"
      ? { id: v.id, token: v.token }
      : null;
  } catch {
    return null;
  }
}

export function readMeRaw(code: string): string | null {
  return readStorage(storageKeys.me(code));
}

export function getMe(code: string): Me | null {
  return parseMe(readMeRaw(code));
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ME_CHANGE_EVENT));
  }
}

export function setMe(code: string, me: Me): void {
  writeStorage(storageKeys.me(code), JSON.stringify(me));
  notify();
}

export function clearMe(code: string): void {
  removeStorage(storageKeys.me(code));
  notify();
}
