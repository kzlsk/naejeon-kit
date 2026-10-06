import { Button } from "@/components/ui/Button";
import type { MapKey } from "@/lib/constants";

import { MAX_BANS, remainingMaps } from "./bans";
import { MapTile } from "./MapCard";

type MapBanPanelProps = {
  showTitle?: boolean;
  pool: MapKey[];
  bans: MapKey[];
  rolling?: boolean;
  onToggle: (map: MapKey) => void;
  onRoll: () => void;
  onEditPool: () => void;
};

/** 방장 맵 밴 선택 + 맵 랜덤 — 시안 MapBan (F6-2, F6-3) */
export function MapBanPanel({
  showTitle = true,
  pool,
  bans,
  rolling,
  onToggle,
  onRoll,
  onEditPool,
}: MapBanPanelProps) {
  const remaining = remainingMaps(pool, bans).length;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        {showTitle && <h2 className="text-[17px] font-semibold">맵</h2>}
        <Button size="sm" className="ml-auto" onClick={onEditPool}>
          맵 풀 설정
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold">
            밴할 맵{" "}
            <span className="text-muted font-normal">(최대 {MAX_BANS}개)</span>
          </span>
          <span className="text-accent font-mono text-sm font-semibold">
            {bans.length}/{MAX_BANS}
          </span>
        </div>
        {pool.length === 0 ? (
          <p className="bg-surface text-muted rounded-xl p-4 text-sm">
            맵 풀이 비어 있어요. 맵 풀 설정에서 맵을 켜주세요.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {pool.map((m) => (
              <MapTile
                key={m}
                map={m}
                banned={bans.includes(m)}
                onClick={() => onToggle(m)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <p
          className={`text-center text-[13px] ${remaining ? "text-muted" : "text-danger"}`}
        >
          {remaining
            ? `남은 ${remaining}개 맵 중 하나를 랜덤으로 골라요`
            : "남은 맵이 없어요"}
        </p>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!remaining || rolling}
          onClick={onRoll}
        >
          맵 랜덤 돌리기
        </Button>
      </div>
    </div>
  );
}
