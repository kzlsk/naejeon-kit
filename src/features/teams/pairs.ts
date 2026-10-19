import { storageKeys } from "@/lib/constants";
import { readStorage, writeStorage } from "@/lib/storage";

import type { Member } from "@/features/members/types";

import type { TeamResult } from "./types";

/**
 * 같은 팀 묶음 (F5-8): 무조건 같은 팀이 되어야 하는 두 멤버 id.
 * 한 사람은 한 쌍에만. 5쌍이면 5:5 로 나눌 수 없어서 최대 4쌍.
 */
export type MemberPair = readonly [string, string];

export const MAX_PAIRS = 4;

/** 이미 어떤 쌍에 들어 있는 멤버 id */
export function pairedIds(pairs: readonly MemberPair[]): Set<string> {
  return new Set(pairs.flat());
}

/** 두 사람을 묶은 새 목록. 같은 사람 · 이미 묶인 사람 · 4쌍 초과면 그대로 */
export function addPair(
  pairs: readonly MemberPair[],
  a: string,
  b: string,
): MemberPair[] {
  const taken = pairedIds(pairs);
  if (a === b || taken.has(a) || taken.has(b) || pairs.length >= MAX_PAIRS) {
    return [...pairs];
  }
  return [...pairs, [a, b]];
}

export function removePair(
  pairs: readonly MemberPair[],
  index: number,
): MemberPair[] {
  return pairs.filter((_, i) => i !== index);
}

/** 지금 멤버 목록에 둘 다 있는 쌍만 (삭제된 멤버가 낀 쌍은 버린다) */
export function prunePairs(
  pairs: readonly MemberPair[],
  members: readonly Member[],
): MemberPair[] {
  const ids = new Set(members.map((m) => m.id));
  return pairs.filter(([a, b]) => ids.has(a) && ids.has(b));
}

/** 같은 묶음이면 같은 문자열 (순서 무관) — 팀 조합을 새로 계산할지 판단용 */
export function pairsKey(pairs: readonly MemberPair[]): string {
  return JSON.stringify(pairs.map((p) => [...p].sort().join("+")).sort());
}

/** 팀 A 에 든 id 집합 기준으로 모든 쌍이 같은 쪽에 있는지 */
export function keepsPairs(
  teamA: ReadonlySet<string>,
  pairs: readonly MemberPair[],
): boolean {
  return pairs.every(([a, b]) => teamA.has(a) === teamA.has(b));
}

/** 서로 다른 팀으로 갈라진 쌍 */
export function splitPairs(
  result: TeamResult,
  pairs: readonly MemberPair[],
): MemberPair[] {
  const team1 = new Set(result.teams[0].players.map((p) => p.member.id));
  const all = new Set(
    result.teams.flatMap((t) => t.players.map((p) => p.member.id)),
  );
  return pairs.filter(
    ([a, b]) => all.has(a) && all.has(b) && team1.has(a) !== team1.has(b),
  );
}

/** 선수 교체로 갈라진 쌍이 늘어나면 막는다 (이미 갈라져 있던 쌍은 다시 합치는 교체만 허용) */
export function breaksPair(
  before: TeamResult,
  after: TeamResult,
  pairs: readonly MemberPair[],
): boolean {
  return splitPairs(after, pairs).length > splitPairs(before, pairs).length;
}

/** 방장 브라우저에 저장 (참가자에게는 공유하지 않음) */
export function loadPairs(code: string): MemberPair[] {
  const raw = readStorage(storageKeys.teamPairs(code));
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.reduce<MemberPair[]>((acc, p) => {
      if (
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === "string" &&
        typeof p[1] === "string"
      ) {
        return addPair(acc, p[0], p[1]);
      }
      return acc;
    }, []);
  } catch {
    return [];
  }
}

export function savePairs(code: string, pairs: readonly MemberPair[]): void {
  writeStorage(storageKeys.teamPairs(code), JSON.stringify(pairs));
}
