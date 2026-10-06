import { NICKNAME_MAX_LENGTH } from "@/lib/constants";

/** 줄 단위 닉네임 → 빈 줄·앞뒤 공백 제거, 입력 안 중복 제거 (F3-5) */
export function parseNicknames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim().slice(0, NICKNAME_MAX_LENGTH);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
