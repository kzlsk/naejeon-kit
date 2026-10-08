"use client";

import { Button } from "@/components/ui/Button";
import { LinkIcon } from "@/components/ui/icons";

import { isRiotLinkEnabled } from "../config";

/** 정보 입력 폼 맨 위 보조 버튼. 기능 플래그가 꺼져 있으면 렌더하지 않는다 (라이엇 로고 사용 금지) */
export function RiotConnectButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  if (!isRiotLinkEnabled()) return null;
  return (
    <Button
      variant="surface"
      className="w-full"
      onClick={onClick}
      disabled={disabled}
    >
      <LinkIcon size={16} />
      라이엇 계정 연결
    </Button>
  );
}
