"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { DEFAULT_MAP_POOL, MAPS, type MapKey } from "@/lib/constants";

import { MapImage } from "./MapCard";

const ALL_MAPS = Object.keys(MAPS) as MapKey[];

/** 맵 풀 켜고 끄기 (F6-1) — 시안 없음, 토큰으로 구성 */
export function MapPoolForm({
  initial,
  onSubmit,
}: {
  initial: MapKey[];
  onSubmit: (pool: MapKey[]) => void;
}) {
  const [pool, setPool] = useState<MapKey[]>(initial);
  const toggle = (m: MapKey) =>
    setPool((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-muted text-[13px]">
          켜진 맵 <span className="text-fg font-mono">{pool.length}</span>개
        </span>
        <button
          type="button"
          onClick={() => setPool(DEFAULT_MAP_POOL)}
          className="text-muted h-9 cursor-pointer text-[13px] underline underline-offset-2"
        >
          경쟁전 기본값
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {ALL_MAPS.map((m) => {
          const on = pool.includes(m);
          return (
            <li key={m}>
              <label className="block cursor-pointer">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(m)}
                  className="peer sr-only"
                />
                <MapImage
                  map={m}
                  dimmed={!on}
                  overlay={0.5}
                  className="peer-checked:border-fg peer-focus-visible:outline-fg h-16 rounded-xl border-2 border-transparent peer-focus-visible:outline-2"
                >
                  <span
                    className={`absolute bottom-2 left-3 text-sm font-bold ${on ? "text-white" : "text-faint"}`}
                  >
                    {MAPS[m]}
                  </span>
                  <span
                    className={`absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${on ? "bg-fg text-bg" : "border-line-strong text-faint border"}`}
                  >
                    {on ? "켜짐" : "꺼짐"}
                  </span>
                </MapImage>
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        variant="primary"
        size="lg"
        className="mt-auto w-full"
        disabled={!pool.length}
        onClick={() => onSubmit(ALL_MAPS.filter((m) => pool.includes(m)))}
      >
        저장
      </Button>
    </div>
  );
}
