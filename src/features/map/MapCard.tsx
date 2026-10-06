import type { ReactNode } from "react";

import { MAPS, type MapKey } from "@/lib/constants";

type MapImageProps = {
  map: MapKey;
  className?: string;
  /** 밴 등으로 흐리게 */
  dimmed?: boolean;
  /** 오버레이 진하기 (0~1) */
  overlay?: number;
  children?: ReactNode;
};

/**
 * 맵 이미지 + 어두운 오버레이. `public/maps/{key}.png` 가 없으면 그라데이션만 보인다
 * (배경 이미지라 파일이 없어도 깨진 아이콘이 안 보임).
 */
export function MapImage({
  map,
  className = "",
  dimmed,
  overlay = 0.45,
  children,
}: MapImageProps) {
  return (
    <div
      className={`from-surface-strong to-surface relative overflow-hidden bg-linear-to-br ${className}`}
    >
      <span
        aria-hidden
        className={`absolute inset-0 bg-cover bg-center transition ${dimmed ? "opacity-40 grayscale" : ""}`}
        style={{ backgroundImage: `url(/maps/${map}.png)` }}
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ background: `rgba(10, 13, 17, ${overlay})` }}
      />
      {children}
    </div>
  );
}

type MapTileProps = {
  map: MapKey;
  banned?: boolean;
  picked?: boolean;
  size?: "sm" | "lg";
  onClick?: () => void;
};

/** 맵 그리드 칸 — 시안 MapBan / PcMapBan */
export function MapTile({
  map,
  banned,
  picked,
  size = "sm",
  onClick,
}: MapTileProps) {
  const name = MAPS[map];
  const body = (
    <MapImage
      map={map}
      dimmed={banned}
      overlay={size === "lg" ? 0.4 : 0.45}
      className={`size-full ${size === "lg" ? "rounded-[14px]" : "rounded-[10px]"}`}
    >
      <span
        className={`absolute bottom-2 left-3 font-bold text-white ${banned ? "line-through" : ""} ${size === "lg" ? "bottom-3 left-4 text-xl" : "text-[15px]"}`}
      >
        {name}
      </span>
      {banned && (
        <span className="bg-accent text-bg absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-bold">
          밴
        </span>
      )}
      {picked && (
        <span className="bg-accent text-bg absolute top-2.5 right-2.5 rounded-md px-2.5 py-0.5 text-xs font-bold">
          확정
        </span>
      )}
    </MapImage>
  );

  const frame = `block w-full overflow-hidden rounded-xl border-2 ${banned ? "border-accent" : picked ? "border-accent" : "border-transparent"} ${size === "lg" ? "h-[150px]" : "h-[72px]"}`;

  if (!onClick) return <div className={frame}>{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={banned}
      aria-label={`${name}${banned ? " 밴 해제" : " 밴"}`}
      onClick={onClick}
      className={`${frame} cursor-pointer p-0`}
    >
      {body}
    </button>
  );
}
