"use client";

import { Button } from "@/components/ui/Button";

type RiotConsentSheetProps = {
  open: boolean;
  onAgree: () => void;
  onCancel: () => void;
};

/**
 * (데모) RSO 동의 화면. 실제 연동 때는 라이엇 로그인 페이지로 대체된다.
 * 멤버 수정 Sheet 안에서도 열리므로 Sheet 를 겹쳐 쓰지 않고 한 단계 위(z-50)에 띄운다.
 */
export function RiotConsentSheet({
  open,
  onAgree,
  onCancel,
}: RiotConsentSheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center lg:p-8">
      <div className="absolute inset-0" aria-hidden onClick={onCancel} />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="riot-consent-title"
        className="border-line-subtle bg-panel relative flex w-full flex-col gap-5 rounded-t-2xl border px-5 pt-6 pb-8 lg:max-w-[420px] lg:rounded-2xl lg:p-6"
      >
        <span className="bg-warn-bg text-warn self-start rounded-full px-2.5 py-1 text-xs font-semibold">
          데모 · 실제 라이엇 계정에 연결되지 않아요
        </span>
        <div className="flex flex-col gap-2">
          <h2 id="riot-consent-title" className="text-lg font-bold">
            (데모) 라이엇 로그인 화면
          </h2>
          <p className="text-fg-2 text-[15px] leading-relaxed">
            Riot ID, 현재 티어, 최근 경쟁전에서 자주 플레이한 요원과 이번 액트
            전적(승률·평균 ACS·명중 부위 비율)을 이 방에 공유합니다.
          </p>
          <p className="text-faint text-xs">
            같은 방 멤버에게 표시됩니다 (멤버 목록의 승률·ACS·주 요원 포함).
            방과 함께 24시간 뒤 삭제돼요.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={onAgree}
          >
            동의하고 연결
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}
