import {
  PLAYERS_PER_MATCH,
  POSITIONS,
  TEAM_SIZE,
  type Position,
} from "@/lib/constants";

import type { Member } from "@/features/members/types";

import { memberScore } from "./score";
import type { Team, TeamPlayer, TeamResult } from "./types";

/** 조합 비용 가중치 (PRD §6.3) */
export const W_MISSING = 1000;
export const W_TIER = 10;
export const W_MAIN = 1;

/** [팀 다시 짜기] 로 돌아가며 보여줄 상위 조합 수 (F5-5) */
export const TEAM_OPTION_COUNT = 10;

export type TeamOption = TeamResult & {
  cost: number;
  /** 두 팀 점수 합 차이 */
  scoreDiff: number;
};

type Assignment = {
  players: TeamPlayer[];
  missing: Position[];
  mains: number;
};

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

/** flex 멤버의 추천 포지션: 본인 main 중 하나, 없으면 can 중 하나 (PRD §6.3-2) */
function flexRecommendation(m: Member): Position | null {
  return (
    POSITIONS.find((pos) => m.positions[pos] === "main") ??
    POSITIONS.find((pos) => m.positions[pos] === "can") ??
    null
  );
}

/** 5명 포지션 배정: 120개 순열 중 missing 최소 → mains 최대 (PRD §6.3-2) */
function bestAssignment(
  team: Member[],
  scores: Map<string, number>,
): Assignment {
  let best: Assignment | null = null;
  for (const order of permutations(team)) {
    const missing: Position[] = [];
    let mains = 0;
    POSITIONS.forEach((pos, i) => {
      const level = order[i].positions[pos];
      if (level === "no") missing.push(pos);
      if (level === "main") mains++;
    });
    if (
      best &&
      (missing.length > best.missing.length ||
        (missing.length === best.missing.length && mains <= best.mains))
    ) {
      continue;
    }
    const players: TeamPlayer[] = order.map((member, i) => {
      const slot = i < POSITIONS.length ? POSITIONS[i] : "flex";
      return {
        member,
        score: scores.get(member.id)!,
        slot,
        recommended: slot === "flex" ? flexRecommendation(member) : slot,
        proficiency: slot === "flex" ? null : member.positions[slot],
      };
    });
    best = { players, missing, mains };
  }
  return best!;
}

/** 0..n-1 에서 k 개를 고르는 조합 (사전순) */
function combinations(n: number, k: number, start = 0): number[][] {
  if (k === 0) return [[]];
  const out: number[][] = [];
  for (let i = start; i <= n - k; i++) {
    for (const rest of combinations(n, k - 1, i + 1)) out.push([i, ...rest]);
  }
  return out;
}

/**
 * 가능한 5:5 조합을 비용 오름차순으로 돌려준다 (PRD §6). 순수 함수 — 같은 입력이면 같은 결과.
 * 첫 번째 멤버를 팀1에 고정해 대칭 중복을 없앤 126개 중 상위 `limit` 개.
 * 비용이 같으면 조합 순서(입력 순서 기준)로 정렬한다.
 */
export function rankTeamOptions(
  members: Member[],
  limit = TEAM_OPTION_COUNT,
): TeamOption[] {
  if (members.length !== PLAYERS_PER_MATCH) {
    throw new Error(
      `generateTeams: 멤버가 ${PLAYERS_PER_MATCH}명이어야 해요 (현재 ${members.length}명)`,
    );
  }
  const scores = new Map<string, number>();
  for (const m of members) {
    const s = memberScore(m.currentTier, m.peakTier);
    if (s === null) {
      throw new Error(`generateTeams: ${m.nickname} 티어 미입력`);
    }
    scores.set(m.id, s);
  }

  // 같은 5명 조합은 한 번만 평가
  const cache = new Map<string, Assignment>();
  const evaluate = (idx: number[]) => {
    const key = idx.join(",");
    let a = cache.get(key);
    if (!a) {
      a = bestAssignment(
        idx.map((i) => members[i]),
        scores,
      );
      cache.set(key, a);
    }
    return a;
  };
  const toTeam = (a: Assignment): Team => ({
    players: a.players,
    score: a.players.reduce((sum, p) => sum + p.score, 0),
    missing: a.missing,
  });

  const options: TeamOption[] = combinations(
    PLAYERS_PER_MATCH - 1,
    TEAM_SIZE - 1,
  ).map((rest) => {
    const teamA = [0, ...rest.map((i) => i + 1)];
    const teamB = members.map((_, i) => i).filter((i) => !teamA.includes(i));
    const a = evaluate(teamA);
    const b = evaluate(teamB);
    const t1 = toTeam(a);
    const t2 = toTeam(b);
    const scoreDiff = Math.abs(t1.score - t2.score);
    const cost =
      W_MISSING * (a.missing.length + b.missing.length) +
      W_TIER * scoreDiff -
      W_MAIN * (a.mains + b.mains);
    return { teams: [t1, t2], cost, scoreDiff };
  });

  // Array.prototype.sort 는 안정 정렬 → 비용이 같으면 조합 순서 유지
  return options.sort((x, y) => x.cost - y.cost).slice(0, limit);
}

/** 최적 조합 1개 (PRD §6.4 `generateTeams`) */
export function generateTeams(members: Member[]): TeamResult {
  return rankTeamOptions(members, 1)[0];
}
