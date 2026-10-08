"use client";

import Image from "next/image";
import { useState } from "react";

import { POSITION_LABELS } from "@/lib/constants";

import { agentKeyOf } from "../agents";
import type { RiotTopAgent } from "../types";

/** 요원 아이콘 (둥근 사각). 아이콘이 없거나 못 불러오면 이니셜 원형 */
export function AgentIcon({
  name,
  size = 32,
}: {
  name: string;
  size?: number;
}) {
  const key = agentKeyOf(name);
  const [failed, setFailed] = useState(false);
  if (!key || failed) {
    return (
      <span
        aria-hidden
        className="bg-surface-strong text-fg-2 flex shrink-0 items-center justify-center rounded-full font-semibold"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      >
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <Image
      src={`/agents/${key}.png`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`bg-surface-strong shrink-0 object-cover ${size <= 24 ? "rounded-md" : "rounded-lg"}`}
    />
  );
}

/** 많이 플레이한 요원 (최대 3행). 1위 행만 살짝 강조 */
export function TopAgentsList({ topAgents }: { topAgents: RiotTopAgent[] }) {
  if (topAgents.length === 0) return null;
  return (
    <section aria-label="많이 플레이한 요원" className="flex flex-col gap-1.5">
      <h3 className="text-muted text-xs">많이 플레이한 요원</h3>
      <ol className="flex flex-col gap-1">
        {topAgents.slice(0, 3).map((a, i) => (
          <li
            key={a.agent}
            className={`flex h-12 items-center gap-3 rounded-[10px] px-2.5 ${i === 0 ? "bg-surface-active" : ""}`}
          >
            <AgentIcon name={a.agent} />
            <span className="min-w-0 truncate text-[15px] font-medium">
              {a.agent}
            </span>
            <span className="border-line-strong text-muted shrink-0 rounded-full border px-2 py-0.5 text-[11px]">
              {POSITION_LABELS[a.position]}
            </span>
            <span className="text-fg-2 ml-auto shrink-0 font-mono text-[13px]">
              {a.games}판
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
