/** 테스트용 예시 데이터 — 시안(docs/design-handoff)의 예시와 같은 값 */
import type { PositionProficiency, Tier } from "@/lib/constants";

import type { Member } from "@/features/members/types";
import type { TeamPlayer, TeamResult } from "@/features/teams/types";

const pos = (p: Partial<PositionProficiency> = {}): PositionProficiency => ({
  duelist: "can",
  initiator: "can",
  controller: "can",
  sentinel: "can",
  ...p,
});

const m = (
  id: string,
  nickname: string,
  currentTier: Tier | null,
  positions: PositionProficiency = pos(),
  peakTier: Tier | null = null,
): Member => ({ id, nickname, currentTier, peakTier, positions });

export const DEMO_MEMBERS: Member[] = [
  m(
    "1",
    "철수",
    "gold_2",
    pos({ duelist: "main", controller: "no" }),
    "platinum_1",
  ),
  m("2", "영희", "platinum_1", pos({ initiator: "main" })),
  m("3", "민수", "silver_3", pos({ controller: "main" })),
  m("4", "지훈", "gold_1", pos({ sentinel: "main" })),
  m("5", "수진", "bronze_3", pos({ initiator: "main" })),
  m("6", "현우", "platinum_3", pos({ duelist: "main" })),
  m("7", "다은", "silver_1", pos({ controller: "main" })),
  m("8", "태영", "gold_3", pos({ sentinel: "main" })),
  m("9", "준호", "silver_2", pos({ initiator: "main", controller: "no" })),
  m("10", "서연", null),
];

const byId = Object.fromEntries(DEMO_MEMBERS.map((x) => [x.id, x]));

const player = (
  id: string,
  slot: TeamPlayer["slot"],
  proficiency: TeamPlayer["proficiency"],
  score: number,
): TeamPlayer => ({
  member: { ...byId[id], currentTier: byId[id].currentTier ?? "silver_2" },
  score,
  slot,
  recommended: slot === "flex" ? null : slot,
  proficiency,
});

export const DEMO_TEAMS: TeamResult = {
  teams: [
    {
      score: 68,
      missing: [],
      players: [
        player("1", "duelist", "main", 15.6),
        player("2", "initiator", "main", 13),
        player("3", "controller", "main", 9),
        player("4", "sentinel", "can", 10),
        player("5", "flex", null, 6),
      ],
    },
    {
      score: 67.5,
      missing: ["controller"],
      players: [
        player("6", "duelist", "main", 15),
        player("7", "initiator", "can", 7),
        player("8", "sentinel", "main", 12),
        player("9", "controller", "no", 8),
        player("10", "flex", null, 8),
      ],
    },
  ],
};
