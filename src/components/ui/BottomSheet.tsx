"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { CloseIcon } from "./icons";

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모바일 하단 시트. 닫기 버튼 · ESC · 바깥 탭으로 닫히고, 열려 있는 동안 포커스를 안에 가둔다.
 * 닫히면 열기 전에 포커스가 있던 요소(눌렀던 행)로 돌려준다.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (
        e.shiftKey &&
        (active === first || !dialogRef.current.contains(active))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (active === last || !dialogRef.current.contains(active))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden
        data-testid="bottom-sheet-backdrop"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-label={title}
        className="border-line-subtle bg-panel relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl border-t"
      >
        <div className="flex h-14 shrink-0 items-center justify-between pr-2 pl-5">
          <span
            aria-hidden
            className="bg-line-strong absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full"
          />
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="text-muted hover:text-fg flex size-11 shrink-0 cursor-pointer items-center justify-center"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-8">{children}</div>
      </div>
    </div>
  );
}
