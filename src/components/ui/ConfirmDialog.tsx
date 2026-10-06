"use client";

import { useEffect } from "react";

import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 화면 안 확인 모달 (브라우저 confirm() 대신). 모바일은 하단 시트, PC는 가운데. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center lg:p-8">
      <div className="absolute inset-0" aria-hidden onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-desc" : undefined}
        className="bg-panel border-line-subtle relative flex w-full flex-col gap-5 rounded-t-2xl border px-5 pt-6 pb-7 lg:max-w-[400px] lg:rounded-2xl lg:p-6"
      >
        <div className="flex flex-col gap-2">
          <h2 id="confirm-title" className="text-[17px] font-semibold">
            {title}
          </h2>
          {description && (
            <p id="confirm-desc" className="text-muted text-sm leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="lg"
            className="flex-1 text-base"
            onClick={onCancel}
            autoFocus
          >
            취소
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1 text-base"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
