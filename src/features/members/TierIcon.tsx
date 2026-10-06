import type { Tier } from "@/lib/constants";

import { groupShortLabel, tierGroupOf, type TierGroupOrUnranked } from "./tier";

/** 이미지가 없을 때 보이는 대체 색 (public/tiers/*.png 를 넣으면 이미지가 위에 덮인다) */
const FALLBACK_COLORS: Record<TierGroupOrUnranked, string> = {
  iron: "#6B6F73",
  bronze: "#A26A3F",
  silver: "#B7C1C9",
  gold: "#E2B44C",
  platinum: "#3FB6B3",
  diamond: "#B489F0",
  ascendant: "#3FBF7A",
  immortal: "#D64A5E",
  radiant: "#F6E7A0",
  unranked: "#5C6672",
};

type TierIconProps = {
  /** 티어 값 또는 티어 그룹 키 */
  tier: Tier | TierGroupOrUnranked | null;
  size?: number;
  className?: string;
};

/**
 * 티어 아이콘. `public/tiers/{group}.png` 가 있으면 이미지, 없으면 색 다이아몬드.
 * 배경 이미지로 깔아서 파일이 없으면 아래 대체 모양이 그대로 보인다.
 */
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
  const group = tier.includes("_")
    ? tierGroupOf(tier as Tier)
    : (tier as TierGroupOrUnranked);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      title={groupShortLabel(group)}
    >
      <span
        aria-hidden
        className="absolute rotate-45 rounded-[22%]"
        style={{
          inset: "18%",
          background: FALLBACK_COLORS[group],
          opacity: group === "unranked" ? 0.6 : 0.9,
        }}
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(/tiers/${group}.png)` }}
      />
    </span>
  );
}
