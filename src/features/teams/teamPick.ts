import { storageKeys } from "@/lib/constants";
import { readStorage, writeStorage } from "@/lib/storage";

import type { Member } from "@/features/members/types";

import { rankTeamOptions, type TeamOption } from "./generateTeams";

/** 방장 화면의 팀 결과: 상위 조합 목록 + 지금 보여주는 순번 (F5-4, F5-5) */
export type TeamPick = {
  /** 이 결과를 만든 멤버 입력. 멤버가 바뀌었으면 다음 클릭에서 새로 계산 */
  key: string;
  options: TeamOption[];
  index: number;
};

export function teamInputKey(members: Member[]): string {
  return JSON.stringify(
    members.map((m) => [m.id, m.currentTier, m.peakTier, m.positions]),
  );
}

/** [팀 짜기 / 팀 다시 짜기]: 같은 멤버면 다음 조합, 멤버가 바뀌었으면 새로 계산 */
export function nextTeamPick(
  prev: TeamPick | null,
  members: Member[],
): TeamPick {
  const key = teamInputKey(members);
  if (prev?.key === key) {
    return { ...prev, index: (prev.index + 1) % prev.options.length };
  }
  return { key, options: rankTeamOptions(members), index: 0 };
}

/** 새로고침해도 유지되도록 방장 브라우저에 저장 (팀 다시 짜기를 눌러야만 바뀐다) */
export function loadTeamPick(code: string): TeamPick | null {
  const raw = readStorage(storageKeys.teams(code));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<TeamPick>;
    if (
      typeof v.key !== "string" ||
      !Array.isArray(v.options) ||
      typeof v.index !== "number" ||
      !v.options[v.index]
    ) {
      return null;
    }
    return v as TeamPick;
  } catch {
    return null;
  }
}

export function saveTeamPick(code: string, pick: TeamPick): void {
  writeStorage(storageKeys.teams(code), JSON.stringify(pick));
}
