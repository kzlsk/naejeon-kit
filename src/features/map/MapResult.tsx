import { MAPS, type MapKey } from "@/lib/constants";

import { MapImage } from "./MapCard";

/** 확정 맵 히어로 — 시안 PcHost 맵 카드 / PcParticipant */
export function MapResultHero({
  map,
  label = "이번 판 맵",
  className = "h-[180px]",
}: {
  map: MapKey;
  label?: string;
  className?: string;
}) {
  return (
    <MapImage
      map={map}
      variant="splash"
      sizes="(min-width: 1024px) 50vw, 100vw"
      overlay={0.35}
      className={className}
    >
      <div className="absolute bottom-4 left-5 flex flex-col gap-0.5">
        <span className="text-xs text-[#D6DAE0]">{label}</span>
        <span className="text-[32px] leading-tight font-bold tracking-tight text-white">
          {MAPS[map]}
        </span>
      </div>
    </MapImage>
  );
}

export function formatBans(bans: MapKey[]): string {
  return bans.length ? bans.map((m) => MAPS[m]).join(" · ") : "없음";
}
