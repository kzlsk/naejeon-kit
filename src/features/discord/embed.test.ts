import { describe, expect, it } from "vitest";

import { DEMO_MEMBERS } from "@/lib/dev/fixtures";
import type { Member } from "@/features/members/types";
import { generateTeams } from "@/features/teams/generateTeams";

import {
  buildDiscordMessage,
  DISCORD_COLOR,
  EMBED_LIMITS,
  escapeDiscord,
  teamsEmbed,
  truncate,
} from "./embed";
import {
  parseSendBody,
  parseSendTeams,
  toSendTeams,
  type SendTeams,
} from "./payload";

/** zero-width space */
const ZWSP = String.fromCharCode(0x200b);

const MEMBERS: Member[] = DEMO_MEMBERS.map((m) =>
  m.currentTier ? m : { ...m, currentTier: "silver_2" },
);
const TEAMS = toSendTeams(generateTeams(MEMBERS));

describe("escapeDiscord", () => {
  it("멘션을 무력화한다", () => {
    for (const raw of ["@everyone", "@here", "<@123>", "<@&456>", "<#789>"]) {
      const out = escapeDiscord(raw);
      expect(out).not.toMatch(/@(everyone|here)\b/);
      expect(out).not.toMatch(/<@&?\d+>/);
      expect(out).not.toMatch(/<#\d+>/);
    }
    expect(escapeDiscord("@everyone")).toBe(`@${ZWSP}everyone`);
  });

  it("마크다운 기호를 이스케이프한다", () => {
    expect(escapeDiscord("**굵게**")).toBe("\\*\\*굵게\\*\\*");
    expect(escapeDiscord("_a_ ~~b~~ `c` ||d|| [e](f)")).toBe(
      "\\_a\\_ \\~\\~b\\~\\~ \\`c\\` \\|\\|d\\|\\| \\[e\\]\\(f\\)",
    );
    expect(escapeDiscord("철수")).toBe("철수");
  });
});

describe("임베드", () => {
  it("팀: 팀1·팀2 inline 필드, 점수는 이름 옆, 줄은 '닉네임 — 포지션'", () => {
    const embed = teamsEmbed(TEAMS, "ABC123");
    expect(embed.title).toBe("팀 구성");
    expect(embed.color).toBe(DISCORD_COLOR);
    expect(embed.footer.text).toBe("naejeon-kit · 방 코드 ABC123");
    expect(embed.fields).toHaveLength(2);
    expect(embed.fields![0].name).toBe(`팀1 (${TEAMS[0].score.toFixed(1)})`);
    expect(embed.fields![0].inline).toBe(true);
    expect(embed.fields![0].value.split("\n")).toHaveLength(5);
    expect(embed.fields![0].value).toMatch(/ — /);
  });

  it("닉네임의 멘션·마크다운은 이스케이프되고 allowed_mentions 는 비어 있다", () => {
    const teams: SendTeams = [
      {
        score: 10,
        players: [
          { nickname: "@everyone", position: "duelist", proficiency: "main" },
        ],
      },
      {
        score: 10,
        players: [{ nickname: "**<@1>**", position: null, proficiency: null }],
      },
    ];
    const msg = buildDiscordMessage({ kind: "teams", code: "ABC123", teams })!;
    expect(msg.allowed_mentions).toEqual({ parse: [] });
    expect(msg.username).toBe("naejeon-kit");
    const [t1, t2] = msg.embeds[0].fields!;
    expect(t1.value).toBe(`@${ZWSP}everyone — 타격대 · 주력`);
    expect(t2.value).toBe(`\\*\\*\\<@${ZWSP}1\\>\\*\\*`);
  });

  it("필드 값 한도를 넘으면 남은 인원 수로 줄인다", () => {
    const long = "가".repeat(400);
    const teams = TEAMS.map((t) => ({
      ...t,
      players: t.players.map((p) => ({ ...p, nickname: long })),
    })) as SendTeams;
    const embed = teamsEmbed(teams, "ABC123");
    for (const f of embed.fields!) {
      expect(f.value.length).toBeLessThanOrEqual(EMBED_LIMITS.fieldValue);
      expect(f.value).toMatch(/…외 \d명$/);
    }
    expect(truncate("abcdef", 4)).toBe("abc…");
  });

  it("맵: 밴이 있으면 '밴: A · B'", () => {
    const msg = buildDiscordMessage({
      kind: "map",
      code: "ABC123",
      map: { map: "ascent", bans: ["bind", "lotus"] },
    })!;
    expect(msg.embeds[0]).toMatchObject({
      title: "이번 판 맵",
      description: "어센트\n밴: 바인드 · 로터스",
    });
    const noBan = buildDiscordMessage({
      kind: "map",
      code: "ABC123",
      map: { map: "ascent", bans: [] },
    })!;
    expect(noBan.embeds[0].description).toBe("어센트");
  });

  it("공수 · all · 보낼 게 없으면 null", () => {
    const side = buildDiscordMessage({
      kind: "side",
      code: "X",
      side: "attack",
    })!;
    expect(side.embeds[0].description).toBe("팀1 공격 / 팀2 수비 시작");

    const all = buildDiscordMessage({
      kind: "all",
      code: "X",
      teams: TEAMS,
      map: { map: "haven", bans: [] },
      side: "defense",
    })!;
    expect(all.embeds.map((e) => e.title)).toEqual([
      "팀 구성",
      "이번 판 맵",
      "공수",
    ]);

    // all 은 있는 것만
    expect(
      buildDiscordMessage({ kind: "all", code: "X", side: "attack" })!.embeds,
    ).toHaveLength(1);
    expect(
      buildDiscordMessage({ kind: "map", code: "X", side: "attack" }),
    ).toBeNull();
    expect(buildDiscordMessage({ kind: "all", code: "X" })).toBeNull();
  });
});

describe("전송 body 검증", () => {
  it("방장 화면 팀 결과는 통과", () => {
    expect(parseSendTeams(TEAMS)).toEqual(TEAMS);
  });

  it("팀 2개 · 각 최대 5명 · 닉네임 길이 · 포지션 enum 이 아니면 거부", () => {
    const p = TEAMS[0].players[0];
    const bad: unknown[] = [
      [TEAMS[0]],
      [TEAMS[0], TEAMS[1], TEAMS[1]],
      [{ ...TEAMS[0], players: [...TEAMS[0].players, p] }, TEAMS[1]],
      [{ ...TEAMS[0], players: [] }, TEAMS[1]],
      [
        { ...TEAMS[0], players: [{ ...p, nickname: "가".repeat(17) }] },
        TEAMS[1],
      ],
      [{ ...TEAMS[0], players: [{ ...p, nickname: "  " }] }, TEAMS[1]],
      [{ ...TEAMS[0], players: [{ ...p, position: "support" }] }, TEAMS[1]],
      [{ ...TEAMS[0], players: [{ ...p, proficiency: "god" }] }, TEAMS[1]],
      [{ ...TEAMS[0], score: "10" }, TEAMS[1]],
      "teams",
    ];
    for (const teams of bad) expect(parseSendTeams(teams)).toBeNull();
  });

  it("kind 별 teams 필수 여부", () => {
    const base = { code: "abc123", hostKey: "k" };
    expect(parseSendBody({ ...base, kind: "teams" })).toEqual({
      ok: false,
      error: "INVALID_TEAMS",
    });
    expect(parseSendBody({ ...base, kind: "all" })).toMatchObject({
      ok: true,
      body: { code: "ABC123", kind: "all" },
    });
    expect(parseSendBody({ ...base, kind: "nope" })).toMatchObject({
      ok: false,
    });
    expect(
      parseSendBody({ ...base, code: "../../x", kind: "map" }),
    ).toMatchObject({
      ok: false,
    });
  });
});
