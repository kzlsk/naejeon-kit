import { AGENTS, type AgentKey } from "@/lib/constants";

const KEY_BY_NAME = new Map(
  (Object.entries(AGENTS) as [AgentKey, string][]).map(([key, name]) => [
    name,
    key,
  ]),
);

/** 한글 요원 이름 → 아이콘 키 (`public/agents/{key}.png`). 모르는 요원이면 null */
export function agentKeyOf(name: string): AgentKey | null {
  return KEY_BY_NAME.get(name) ?? null;
}
