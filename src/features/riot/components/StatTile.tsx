import type { ReactNode } from "react";

type StatTileProps = {
  label: string;
  value: string;
  /** 숫자 색 (승률 50% 기준 은은한 구분 등). 기본 text */
  valueClassName?: string;
  /** 숫자 아래 보조 문구 (예: "12승 9패") */
  caption: string;
};

/**
 * 핵심 지표 타일 — 라벨 · 큰 Mono 숫자 · 보조 문구.
 * 부모 그리드의 3줄을 subgrid 로 나눠 써서 나란한 타일끼리 기준선과 높이가 같다. 부모는 StatTileGrid.
 */
export function StatTile({
  label,
  value,
  valueClassName = "text-fg",
  caption,
}: StatTileProps) {
  return (
    <div className="bg-surface row-span-3 grid min-w-0 grid-rows-subgrid gap-y-1 rounded-xl px-3.5 py-2.5">
      <dt className="text-muted text-xs">{label}</dt>
      <dd
        className={`font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums ${valueClassName}`}
      >
        {value}
      </dd>
      <dd className="text-faint truncate text-[11px]">{caption}</dd>
    </div>
  );
}

/** StatTile 2개를 같은 높이·같은 기준선으로 */
export function StatTileGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 grid-rows-[auto_auto_auto] gap-x-2">
      {children}
    </dl>
  );
}
