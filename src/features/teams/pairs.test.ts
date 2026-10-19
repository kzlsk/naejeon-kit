// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_MEMBERS } from "@/lib/dev/fixtures";
import type { Member } from "@/features/members/types";

import { generateTeams, rankTeamOptions } from "./generateTeams";
import {
  addPair,
  breaksPair,
  loadPairs,
  MAX_PAIRS,
  pairsKey,
  prunePairs,
  removePair,
  savePairs,
  splitPairs,
  type MemberPair,
} from "./pairs";
import { swapPlayers } from "./swap";
import { nextTeamPick } from "./teamPick";
import type { TeamResult } from "./types";

/** 10명 모두 티어 입력된 멤버 (id "1" ~ "10") */
const MEMBERS: Member[] = DEMO_MEMBERS.map((m) =>
  m.currentTier ? m : { ...m, currentTier: "silver_2" },
);

const teamOf = (r: TeamResult, id: string) =>
  r.teams.findIndex((t) => t.players.some((p) => p.member.id === id));

describe("묶음 목록", () => {
  it("addPair: 같은 사람 · 이미 묶인 사람 · 4쌍 초과는 무시", () => {
    let pairs: MemberPair[] = [];
    pairs = addPair(pairs, "1", "2");
    expect(pairs).toEqual([["1", "2"]]);
    expect(addPair(pairs, "3", "3")).toEqual(pairs);
    expect(addPair(pairs, "2", "3")).toEqual(pairs);

    pairs = addPair(addPair(addPair(pairs, "3", "4"), "5", "6"), "7", "8");
    expect(pairs).toHaveLength(MAX_PAIRS);
    expect(addPair(pairs, "9", "10")).toEqual(pairs);
    expect(removePair(pairs, 0)[0]).toEqual(["3", "4"]);
  });

  it("prunePairs: 삭제된 멤버가 낀 쌍은 버린다", () => {
    const pairs: MemberPair[] = [
      ["1", "2"],
      ["3", "gone"],
    ];
    expect(prunePairs(pairs, MEMBERS)).toEqual([["1", "2"]]);
  });

  it("pairsKey: 순서가 달라도 같은 묶음이면 같다", () => {
    expect(
      pairsKey([
        ["1", "2"],
        ["3", "4"],
      ]),
    ).toBe(
      pairsKey([
        ["4", "3"],
        ["2", "1"],
      ]),
    );
    expect(pairsKey([["1", "2"]])).not.toBe(pairsKey([["1", "3"]]));
  });
});

describe("묶음을 지키는 팀 생성", () => {
  it("묶은 두 명은 모든 상위 조합에서 같은 팀", () => {
    // 묶지 않으면 갈라지는 두 사람을 고른다
    const free = generateTeams(MEMBERS);
    const a = free.teams[0].players[0].member.id;
    const b = free.teams[1].players[0].member.id;
    expect(teamOf(free, a)).not.toBe(teamOf(free, b));

    const options = rankTeamOptions(MEMBERS, undefined, [[a, b]]);
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) expect(teamOf(o, a)).toBe(teamOf(o, b));
  });

  it("4쌍이어도 조합이 나오고 모두 지킨다", () => {
    const pairs: MemberPair[] = [
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
      ["7", "8"],
    ];
    const options = rankTeamOptions(MEMBERS, undefined, pairs);
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) expect(splitPairs(o, pairs)).toEqual([]);
  });

  it("목록에 없는 멤버가 낀 쌍은 무시", () => {
    expect(rankTeamOptions(MEMBERS, undefined, [["1", "gone"]])).toEqual(
      rankTeamOptions(MEMBERS),
    );
  });

  it("nextTeamPick: 묶음이 바뀌면 새로 계산, 묶음이 없으면 예전 키 그대로", () => {
    const plain = nextTeamPick(null, MEMBERS);
    expect(nextTeamPick(plain, MEMBERS, []).index).toBe(1);

    const paired = nextTeamPick(plain, MEMBERS, [["1", "10"]]);
    expect(paired.index).toBe(0);
    expect(paired.key).not.toBe(plain.key);
    expect(nextTeamPick(paired, MEMBERS, [["10", "1"]]).index).toBe(1);
  });
});

describe("선수 교체와 묶음", () => {
  const pairs: MemberPair[] = [["1", "2"]];
  const base = generateTeams(MEMBERS, pairs);
  const mate = teamOf(base, "1");
  const other = base.teams[1 - mate].players[0].member.id;

  it("묶인 사람을 다른 팀과 바꾸면 쌍이 갈라져 막는다", () => {
    const after = swapPlayers(base, "1", other);
    expect(breaksPair(base, after, pairs)).toBe(true);
  });

  it("묶이지 않은 두 명끼리의 교체는 허용", () => {
    const x = base.teams[mate].players.find(
      (p) => p.member.id !== "1" && p.member.id !== "2",
    )!.member.id;
    const after = swapPlayers(base, x, other);
    expect(breaksPair(base, after, pairs)).toBe(false);
  });

  it("이미 갈라진 쌍을 합치는 교체는 허용", () => {
    const free = generateTeams(MEMBERS);
    const a = free.teams[0].players[0].member.id;
    const b = free.teams[1].players[0].member.id;
    const c = free.teams[0].players[1].member.id;
    const after = swapPlayers(free, c, b); // b 가 a 쪽으로
    expect(breaksPair(free, after, [[a, b]])).toBe(false);
    expect(splitPairs(after, [[a, b]])).toEqual([]);
  });
});

describe("저장", () => {
  beforeEach(() => localStorage.clear());

  it("저장 후 그대로 읽고, 깨진 값은 빈 목록", () => {
    savePairs("ABC123", [["1", "2"]]);
    expect(loadPairs("ABC123")).toEqual([["1", "2"]]);
    localStorage.setItem("team_pairs:ABC123", "{oops");
    expect(loadPairs("ABC123")).toEqual([]);
    localStorage.setItem(
      "team_pairs:ABC123",
      JSON.stringify([
        ["1", "1"],
        ["2", 3],
        ["4", "5"],
      ]),
    );
    expect(loadPairs("ABC123")).toEqual([["4", "5"]]);
  });
});
