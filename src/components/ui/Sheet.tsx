"use client";

import { useEffect, type ReactNode } from "react";

import { BackIcon, CloseIcon } from "./icons";

type SheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 모바일 모양 — full: 전체 화면(기본), bottom: 하단 시트. PC 는 둘 다 가운데 모달 */
  mobile?: "full" | "bottom";
};

/**
 * 모바일: 전체 화면 (시안 MemberForm처럼 뒤로 버튼 + 제목)
 * PC(lg): 가운데 모달
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  mobile = "full",
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const bottom = mobile === "bottom";

  return (
    <div
      className={`fixed inset-0 z-40 flex justify-center lg:items-center lg:bg-black/60 lg:p-8 ${bottom ? "items-end bg-black/60" : "items-stretch"}`}
    >
      <div
        className={`absolute inset-0 ${bottom ? "" : "hidden lg:block"}`}
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`lg:border-line-subtle lg:bg-panel relative flex w-full flex-col overflow-y-auto lg:max-h-full lg:max-w-[460px] lg:rounded-2xl lg:border ${bottom ? "border-line-subtle bg-panel max-h-[92dvh] rounded-t-2xl border-t" : "bg-bg"}`}
      >
        <div
          className={`sticky top-0 z-10 flex shrink-0 items-center gap-2 bg-inherit px-5 lg:h-16 lg:pt-0 ${bottom ? "h-14" : "h-[60px] pt-4"}`}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className={`text-fg lg:text-muted flex size-11 cursor-pointer items-center justify-center lg:order-last lg:mr-[-12px] lg:ml-auto ${bottom ? "order-last mr-[-12px] ml-auto" : "-ml-3"}`}
          >
            {bottom ? (
              <CloseIcon size={20} />
            ) : (
              <>
                <BackIcon size={22} className="lg:hidden" />
                <CloseIcon size={20} className="hidden lg:block" />
              </>
            )}
          </button>
          <h2 className="text-[17px] font-semibold">{title}</h2>
        </div>
        <div className="flex flex-1 flex-col px-5 pt-4 pb-6 lg:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
