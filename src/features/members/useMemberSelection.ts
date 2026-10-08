"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { Member } from "./types";

const PARAM = "member";

/**
 * 멤버 목록에서 고른 멤버 — URL `?member=<id>` 에 둔다 (새로고침 유지, 뒤로가기로 이전 선택).
 * - selectedId: URL 의 id 가 목록에 있으면 그 id, 아니면 defaultId (참가자: 본인, 방장: null)
 * - requestedId: URL 로 직접 고른 id (모바일 하단 시트를 여는 기준)
 * - URL 의 멤버가 목록에서 사라지면(실시간 삭제) 파라미터를 지워 기본 선택으로 되돌린다
 */
export function useMemberSelection(
  members: readonly Member[] | undefined,
  defaultId: string | null,
) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get(PARAM);
  const exists = !!requested && !!members?.some((m) => m.id === requested);

  const urlWith = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set(PARAM, id);
      else next.delete(PARAM);
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  useEffect(() => {
    if (requested && members && !exists) {
      router.replace(urlWith(null), { scroll: false });
    }
  }, [requested, members, exists, router, urlWith]);

  /** 고르기 — 히스토리에 남겨서 뒤로가기로 이전 선택 */
  const select = useCallback(
    (id: string) => {
      if (id === requested) return;
      router.push(urlWith(id), { scroll: false });
    },
    [requested, router, urlWith],
  );

  /** 직접 고른 것 해제 (모바일 시트 닫기) → 기본 선택 */
  const clear = useCallback(() => {
    if (requested) router.replace(urlWith(null), { scroll: false });
  }, [requested, router, urlWith]);

  return {
    selectedId: exists ? requested : defaultId,
    requestedId: exists ? requested : null,
    select,
    clear,
  };
}

/** Tailwind `lg` (64rem) 이상 — 왼쪽 패널이 있는 PC 레이아웃 */
const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
