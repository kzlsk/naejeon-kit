import Image from "next/image";

import type { Tier } from "@/lib/constants";

import { formatTier } from "./tier";

type TierIconProps = {
  /** null = 정보 미입력 (점선 원) */
  tier: Tier | null;
  size?: number;
  className?: string;
};

/** 티어 아이콘 — `public/tiers/{tier}.png` (`npm run fetch-assets` 로 받음) */
export function TierIcon({ tier, size = 24, className = "" }: TierIconProps) {
  if (!tier) {
    return (
      <span
        aria-hidden
        className={`border-line-strong box-border shrink-0 rounded-full border-[1.5px] border-dashed ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Image
      src={`/tiers/${tier}.png`}
      alt=""
      title={formatTier(tier)}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
