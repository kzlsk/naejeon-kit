import { formatPct } from "../format";

type HitDistributionProps = {
  /** 0~1 */
  head: number;
  body: number;
  leg: number;
};

/** 부위별 실루엣 path (viewBox 0 0 64 128) */
const PARTS = [
  {
    key: "head",
    label: "머리",
    d: "M32 3a11 11 0 1 1 0 22a11 11 0 1 1 0-22z",
  },
  {
    key: "body",
    label: "몸",
    d: "M18 29h28a8 8 0 0 1 8 8v30a4 4 0 0 1-8 0V42h-1v30H19V42h-1v25a4 4 0 0 1-8 0V37a8 8 0 0 1 8-8z",
  },
  {
    key: "leg",
    label: "다리",
    d: "M19 75h26v47a5 5 0 0 1-10 0V92h-6v30a5 5 0 0 1-10 0z",
  },
] as const;

/** 가장 많이 맞힌 부위 대비 비율 → 명도 단계 (높을수록 진하게) */
function shade(value: number, max: number): number {
  if (max <= 0) return 0.12;
  const r = value / max;
  if (r >= 0.75) return 1;
  if (r >= 0.4) return 0.6;
  if (r >= 0.15) return 0.35;
  return 0.15;
}

/** 명중 분포 — 실루엣(명도) + 부위명·% 숫자·얇은 막대. 색만으로 구분하지 않는다 */
export function HitDistribution({ head, body, leg }: HitDistributionProps) {
  const values = { head, body, leg };
  const max = Math.max(head, body, leg);
  const summary = PARTS.map(
    (p) => `${p.label} ${formatPct(values[p.key])}`,
  ).join(", ");

  return (
    <section
      aria-label="명중 분포"
      className="bg-surface flex items-center gap-5 rounded-xl px-4 py-3.5"
    >
      <svg
        viewBox="0 0 64 128"
        width={48}
        height={96}
        role="img"
        aria-label={`명중 분포: ${summary}`}
        className="shrink-0"
      >
        {PARTS.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill="var(--color-accent)"
            fillOpacity={shade(values[p.key], max)}
            stroke="var(--color-line-strong)"
            strokeWidth={1}
          />
        ))}
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <h3 className="text-muted text-xs">명중 분포</h3>
        <dl className="flex flex-col gap-2.5">
          {PARTS.map((p) => (
            <div key={p.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-[13px]">
                <dt className="text-fg-2">{p.label}</dt>
                <dd className="font-mono font-semibold">
                  {formatPct(values[p.key])}
                </dd>
              </div>
              <div
                aria-hidden
                className="bg-line h-1 overflow-hidden rounded-full"
              >
                <div
                  className="bg-accent h-full rounded-full"
                  style={{
                    width: `${values[p.key] * 100}%`,
                    opacity: shade(values[p.key], max),
                  }}
                />
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
