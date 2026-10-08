/**
 * supabase/migrations 를 PGlite(WASM Postgres)에 적용해서 RPC 권한·동작을 검증한다.
 * Docker 없이 돌아가도록 Supabase 가 기본 제공하는 것(anon 역할, extensions 스키마,
 * supabase_realtime publication)만 흉내 낸다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, describe, expect, it } from "vitest";

import { aggregateRiotMatches } from "@/features/riot/computeStats";
import { mockStats } from "@/features/riot/mockProvider";
import { RIOT_STATS_KEYS, type RiotStats } from "@/features/riot/types";

const MIGRATIONS = join(__dirname, "..", "migrations");
const POSITIONS = JSON.stringify({
  duelist: "main",
  initiator: "can",
  controller: "can",
  sentinel: "no",
});

let db: PGlite;

/** anon 역할로 RPC 호출 (PostgREST 와 같은 조건) */
async function asAnon<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("set role anon");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

async function expectError(promise: Promise<unknown>, message: string) {
  await expect(promise).rejects.toThrow(message);
}

const createRoom = async () =>
  (
    await asAnon<{ r: { code: string; host_key: string } }>(
      "select create_room() as r",
    )
  )[0].r;

const registerSelf = async (code: string, nickname: string, tier = "gold_2") =>
  (
    await asAnon<{ r: { member_id: string; edit_token: string } }>(
      "select register_self($1, $2, $3, null, $4::jsonb) as r",
      [code, nickname, tier, POSITIONS],
    )
  )[0].r;

const members = async () =>
  asAnon<{ id: string; nickname: string; current_tier: string | null }>(
    "select id, nickname, current_tier from members order by created_at",
  );

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema extensions;
    grant usage on schema public, extensions to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create publication supabase_realtime;
  `);
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
});

describe("rooms", () => {
  it("create_room: 6자리 코드 + 방장 키를 돌려준다", async () => {
    const room = await createRoom();
    expect(room.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(room.host_key).toMatch(/^[0-9a-f]{48}$/);
  });

  it("비밀 테이블은 anon 이 읽을 수 없다", async () => {
    await expectError(
      asAnon("select * from room_secrets"),
      "permission denied",
    );
    await expectError(
      asAnon("select * from member_tokens"),
      "permission denied",
    );
  });

  it("공개 테이블에 직접 쓸 수 없다", async () => {
    await expectError(
      asAnon("insert into rooms (code) values ('ZZZZZZ')"),
      "row-level security",
    );
  });
});

describe("참가자 본인 RPC", () => {
  it("register → update → delete 를 토큰으로 한다", async () => {
    const { code } = await createRoom();
    const me = await registerSelf(code.toLowerCase(), "  철수 ");
    expect(me.edit_token).toMatch(/^[0-9a-f]{48}$/);

    await asAnon(
      "select update_self($1, $2, '철수2', 'platinum_1', 'diamond_1', $3::jsonb)",
      [me.member_id, me.edit_token, POSITIONS],
    );
    expect((await members()).find((m) => m.id === me.member_id)).toMatchObject({
      nickname: "철수2",
      current_tier: "platinum_1",
    });

    await asAnon("select delete_self($1, $2)", [me.member_id, me.edit_token]);
    expect((await members()).some((m) => m.id === me.member_id)).toBe(false);
    // 토큰도 cascade 로 삭제
    expect(
      (
        await db.query("select 1 from member_tokens where member_id = $1", [
          me.member_id,
        ])
      ).rows,
    ).toHaveLength(0);
  });

  it("남의 member_id 에 다른 토큰으로 수정·삭제하면 FORBIDDEN", async () => {
    const { code } = await createRoom();
    const a = await registerSelf(code, "영희");
    const b = await registerSelf(code, "민수");

    await expectError(
      asAnon("select update_self($1, $2, '해킹', 'gold_1', null, $3::jsonb)", [
        a.member_id,
        b.edit_token,
        POSITIONS,
      ]),
      "FORBIDDEN",
    );
    await expectError(
      asAnon("select delete_self($1, $2)", [a.member_id, "deadbeef"]),
      "FORBIDDEN",
    );
    await expectError(
      asAnon("select delete_self($1, null)", [a.member_id]),
      "FORBIDDEN",
    );
    expect((await members()).find((m) => m.id === a.member_id)?.nickname).toBe(
      "영희",
    );
  });

  it("없는 방은 ROOM_NOT_FOUND, 같은 방 닉네임 중복은 NICKNAME_TAKEN", async () => {
    await expectError(registerSelf("NOPE22", "철수"), "ROOM_NOT_FOUND");

    const { code } = await createRoom();
    const a = await registerSelf(code, "지훈");
    const b = await registerSelf(code, "수진");
    await expectError(registerSelf(code, "지훈"), "NICKNAME_TAKEN");
    await expectError(
      asAnon("select update_self($1, $2, '지훈', 'gold_1', null, $3::jsonb)", [
        b.member_id,
        b.edit_token,
        POSITIONS,
      ]),
      "NICKNAME_TAKEN",
    );

    // 다른 방이면 같은 닉네임 가능
    const other = await createRoom();
    await expect(registerSelf(other.code, "지훈")).resolves.toBeDefined();
    expect(a.member_id).toBeTruthy();
  });

  it("입력 검증: 현티 필수, 언랭이면 최티 필수, 포지션 형식", async () => {
    const { code } = await createRoom();
    await expectError(
      asAnon("select register_self($1, '현우', null, null, $2::jsonb)", [
        code,
        POSITIONS,
      ]),
      "INVALID_TIER",
    );
    await expectError(
      asAnon("select register_self($1, '현우', 'unranked', null, $2::jsonb)", [
        code,
        POSITIONS,
      ]),
      "INVALID_TIER",
    );
    await expectError(
      asAnon(
        `select register_self($1, '현우', 'gold_1', null, '{"duelist":"main"}'::jsonb)`,
        [code],
      ),
      "INVALID_POSITIONS",
    );
    await expect(
      asAnon(
        "select register_self($1, '현우', 'unranked', 'gold_3', $2::jsonb)",
        [code, POSITIONS],
      ),
    ).resolves.toBeDefined();
  });
});

describe("라이엇 연결 정보", () => {
  const AGENTS = JSON.stringify([
    { agent: "제트", position: "duelist", games: 34 },
    { agent: "소바", position: "initiator", games: 12 },
  ]);
  const riotOf = async (id: string) =>
    (
      await asAnon<{ riot_id: string | null; top_agents: unknown }>(
        "select riot_id, top_agents from members where id = $1",
        [id],
      )
    )[0];

  it("register_self 에 선택값으로 저장, update_self 에 null 이면 연결 해제", async () => {
    const { code } = await createRoom();
    const me = (
      await asAnon<{ r: { member_id: string; edit_token: string } }>(
        "select register_self($1, '철수', 'gold_2', null, $2::jsonb, '철수#KR1', $3::jsonb) as r",
        [code, POSITIONS, AGENTS],
      )
    )[0].r;
    expect(await riotOf(me.member_id)).toEqual({
      riot_id: "철수#KR1",
      top_agents: JSON.parse(AGENTS),
    });

    await asAnon(
      "select update_self($1, $2, '철수', 'gold_2', null, $3::jsonb, null, null)",
      [me.member_id, me.edit_token, POSITIONS],
    );
    expect(await riotOf(me.member_id)).toEqual({
      riot_id: null,
      top_agents: null,
    });
  });

  it("인자를 생략한 예전 호출도 동작한다 (연결 안 함)", async () => {
    const { code } = await createRoom();
    const me = await registerSelf(code, "영희");
    expect((await riotOf(me.member_id)).riot_id).toBeNull();
  });

  it("방장 수정으로도 저장된다", async () => {
    const { code, host_key } = await createRoom();
    const id = (
      await asAnon<{ id: string }>(
        "select upsert_member_as_host($1, $2, null, '민수', 'silver_1', null, $3::jsonb, '민수#KR2', $4::jsonb) as id",
        [code, host_key, POSITIONS, AGENTS],
      )
    )[0].id;
    expect((await riotOf(id)).riot_id).toBe("민수#KR2");
  });

  it.each([
    ["태그 없는 Riot ID", "철수", AGENTS],
    [
      "요원 4개",
      "철수#KR1",
      JSON.stringify(Array(4).fill(JSON.parse(AGENTS)[0])),
    ],
    [
      "모르는 포지션",
      "철수#KR1",
      JSON.stringify([{ agent: "제트", position: "flex", games: 1 }]),
    ],
    [
      "숫자 점수 필드 추가",
      "철수#KR1",
      JSON.stringify([
        { agent: "제트", position: "duelist", games: 1, acs: 250 },
      ]),
    ],
    ["Riot ID 없이 요원만", null, AGENTS],
  ])("검증 실패: %s → INVALID_RIOT", async (_, riotId, agents) => {
    const { code } = await createRoom();
    await expectError(
      asAnon(
        "select register_self($1, '현우', 'gold_1', null, $2::jsonb, $3, $4::jsonb)",
        [code, POSITIONS, riotId, agents],
      ),
      "INVALID_RIOT",
    );
  });
});

describe("라이엇 전적 지표: 프론트 타입 ↔ DB 검증", () => {
  const sorted = (keys: Iterable<string>) => [...keys].sort();
  const registerWith = async (stats: unknown) => {
    const { code } = await createRoom();
    return asAnon(
      "select register_self($1, '철수', 'gold_2', null, $2::jsonb, '철수#KR1', null, $3::jsonb)",
      [code, POSITIONS, JSON.stringify(stats)],
    );
  };

  /** 가장 최근 마이그레이션의 _validate_riot_stats 에서 필수·선택 키 목록을 뽑는다 */
  function dbValidationKeys() {
    const sql = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
      .filter((text) => /function public\._validate_riot_stats\b/.test(text))
      .at(-1)!;
    const body = sql.slice(
      sql.search(/function public\._validate_riot_stats\b/),
    );
    const list = (name: string) => {
      const m = body.match(
        new RegExp(`${name} constant text\\[\\] := array\\[([^\\]]*)\\]`),
      );
      if (!m)
        throw new Error(
          `${name} 목록을 찾지 못함 — 마이그레이션 형식이 바뀌면 이 파서도 고칠 것`,
        );
      return [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
    };
    return { required: list("v_required"), optional: list("v_optional") };
  }

  /** 프론트가 실제로 보내는 stats (mock / 실제 집계 둘 다) */
  const frontendPayloads = (): [string, RiotStats][] => [
    ["mockStats", mockStats(() => 0.5, 15)!],
    [
      "aggregateRiotMatches",
      aggregateRiotMatches(
        [
          {
            matchInfo: {
              queueId: "competitive",
              gameStartMillis: 0,
              seasonId: "a",
            },
            players: [
              {
                puuid: "me",
                teamId: "Blue",
                characterId: "no-such-uuid",
                stats: { score: 4000, roundsPlayed: 20 },
              },
            ],
            teams: [{ teamId: "Blue", won: true }],
            roundResults: [
              {
                playerStats: [
                  {
                    puuid: "me",
                    damage: [{ headshots: 2, bodyshots: 7, legshots: 1 }],
                  },
                ],
              },
            ],
          },
        ],
        "me",
      ).stats!,
    ],
  ];

  it("마이그레이션의 검증 키(필수 ∪ 선택) = RIOT_STATS_KEYS", () => {
    const { required, optional } = dbValidationKeys();
    expect(required.filter((k) => optional.includes(k))).toEqual([]);
    expect(sorted([...required, ...optional])).toEqual(sorted(RIOT_STATS_KEYS));
  });

  it.each(frontendPayloads())("%s 결과의 키 = RIOT_STATS_KEYS", (_, stats) => {
    expect(sorted(Object.keys(stats))).toEqual(sorted(RIOT_STATS_KEYS));
  });

  it.each(frontendPayloads())(
    "%s 결과를 DB 가 받아들인다",
    async (_, stats) => {
      await expect(registerWith(stats)).resolves.toBeDefined();
    },
  );

  it.each(RIOT_STATS_KEYS.map((k) => [k]))(
    "%s 가 빠졌을 때 DB 동작이 필수/선택 목록과 같다",
    async (key) => {
      const { optional } = dbValidationKeys();
      const stats: Record<string, number> = { ...mockStats(() => 0.5, 15)! };
      delete stats[key];
      if (optional.includes(key)) {
        await expect(registerWith(stats)).resolves.toBeDefined();
      } else {
        await expectError(registerWith(stats), "INVALID_RIOT");
      }
    },
  );

  it("프론트가 모르는 키는 DB 가 거부한다", async () => {
    await expectError(
      registerWith({ ...mockStats(() => 0.5, 15)!, rating: 1500 }),
      "INVALID_RIOT",
    );
  });
});

describe("라이엇 전적 지표", () => {
  const STATS = {
    matchCount: 20,
    wins: 11,
    winRate: 0.55,
    avgAcs: 210.5,
    headshotPct: 0.25,
    bodyshotPct: 0.7,
    legshotPct: 0.05,
  };
  const register = (code: string, riotId: string | null, stats: unknown) =>
    asAnon<{ r: { member_id: string; edit_token: string } }>(
      "select register_self($1, '철수', 'gold_2', null, $2::jsonb, $3, null, $4::jsonb) as r",
      [code, POSITIONS, riotId, stats === null ? null : JSON.stringify(stats)],
    );
  const statsOf = async (id: string) =>
    (
      await asAnon<{ riot_stats: unknown }>(
        "select riot_stats from members where id = $1",
        [id],
      )
    )[0].riot_stats;

  it("저장 → update_self 에서 null 이면 삭제", async () => {
    const { code } = await createRoom();
    const me = (await register(code, "철수#KR1", STATS))[0].r;
    expect(await statsOf(me.member_id)).toEqual(STATS);

    await asAnon(
      "select update_self($1, $2, '철수', 'gold_2', null, $3::jsonb, '철수#KR1', null, null)",
      [me.member_id, me.edit_token, POSITIONS],
    );
    expect(await statsOf(me.member_id)).toBeNull();
  });

  it("wins 는 선택값 — 예전 6개 키도 저장된다", async () => {
    const { code } = await createRoom();
    const legacy = Object.fromEntries(
      Object.entries(STATS).filter(([k]) => k !== "wins"),
    );
    const me = (await register(code, "철수#KR1", legacy))[0].r;
    expect(await statsOf(me.member_id)).toEqual(legacy);
  });

  it("방장 수정으로도 저장, 명중 기록이 없으면 전부 0 허용", async () => {
    const { code, host_key } = await createRoom();
    const zero = { ...STATS, headshotPct: 0, bodyshotPct: 0, legshotPct: 0 };
    const id = (
      await asAnon<{ id: string }>(
        "select upsert_member_as_host($1, $2, null, '민수', 'silver_1', null, $3::jsonb, '민수#KR2', null, $4::jsonb) as id",
        [code, host_key, POSITIONS, JSON.stringify(zero)],
      )
    )[0].id;
    expect(await statsOf(id)).toEqual(zero);
  });

  it.each([
    ["Riot ID 없이 지표만", null, STATS],
    ["0판", "철수#KR1", { ...STATS, matchCount: 0 }],
    ["31판", "철수#KR1", { ...STATS, matchCount: 31 }],
    ["판 수 소수", "철수#KR1", { ...STATS, matchCount: 2.5 }],
    ["승률 1 초과", "철수#KR1", { ...STATS, winRate: 1.2 }],
    ["wins 가 판 수보다 큼", "철수#KR1", { ...STATS, wins: 21, winRate: 1 }],
    ["wins 음수", "철수#KR1", { ...STATS, wins: -1, winRate: 0 }],
    ["wins 소수", "철수#KR1", { ...STATS, wins: 10.5 }],
    ["명중 부위 합이 1 아님", "철수#KR1", { ...STATS, legshotPct: 0.3 }],
    ["문자열 값", "철수#KR1", { ...STATS, avgAcs: "210" }],
    ["합산 점수 필드 추가", "철수#KR1", { ...STATS, rating: 1500 }],
  ])("검증 실패: %s → INVALID_RIOT", async (_, riotId, stats) => {
    const { code } = await createRoom();
    await expectError(register(code, riotId, stats), "INVALID_RIOT");
  });
});

describe("방장 RPC", () => {
  it("방장 키가 맞아야 추가·수정·삭제할 수 있다", async () => {
    const { code, host_key } = await createRoom();
    const member = await registerSelf(code, "다은");

    await expectError(
      asAnon("select delete_member($1, 'wrong', $2)", [code, member.member_id]),
      "FORBIDDEN",
    );
    await expectError(
      asAnon("select verify_host_key($1, 'wrong')", [code]),
      "FORBIDDEN",
    );
    await asAnon("select verify_host_key($1, $2)", [code, host_key]);

    // 방장은 참가자가 등록한 멤버도 수정 가능
    await asAnon(
      "select upsert_member_as_host($1, $2, $3, '다은', null, null, $4::jsonb)",
      [code, host_key, member.member_id, POSITIONS],
    );
    expect(
      (await members()).find((m) => m.id === member.member_id)?.current_tier,
    ).toBeNull();

    await asAnon("select delete_member($1, $2, $3)", [
      code,
      host_key,
      member.member_id,
    ]);
    expect((await members()).some((m) => m.id === member.member_id)).toBe(
      false,
    );
    // 방장이 지운 뒤에는 참가자 토큰도 무효
    await expectError(
      asAnon("select delete_self($1, $2)", [
        member.member_id,
        member.edit_token,
      ]),
      "FORBIDDEN",
    );
  });

  it("일괄 등록은 중복을 건너뛰고 알려준다", async () => {
    const { code, host_key } = await createRoom();
    await registerSelf(code, "태영");
    const rows = await asAnon<{ skipped: string[] }>(
      "select bulk_add_members($1, $2, $3) as skipped",
      [code, host_key, ["태영", " 준호 ", "", "서연"]],
    );
    expect(rows[0].skipped).toEqual(["태영"]);
  });

  it("다른 방의 멤버는 지울 수 없다", async () => {
    const roomA = await createRoom();
    const roomB = await createRoom();
    const victim = await registerSelf(roomB.code, "준호");
    await asAnon("select delete_member($1, $2, $3)", [
      roomA.code,
      roomA.host_key,
      victim.member_id,
    ]);
    expect((await members()).some((m) => m.id === victim.member_id)).toBe(true);
  });
});

describe("맵 · 공수 RPC", () => {
  const room = async (code: string) =>
    (
      await asAnon<{
        map_pool: string[];
        map_bans: string[];
        result_map: string | null;
        map_roll_id: string | null;
        side_team1: string | null;
      }>(
        "select map_pool, map_bans, result_map, map_roll_id, side_team1 from rooms where code = $1",
        [code],
      )
    )[0];

  const rollMap = async (code: string, key: string, bans: string[]) =>
    (
      await asAnon<{ r: { map: string; roll_id: string } }>(
        "select roll_map($1, $2, $3) as r",
        [code, key, bans],
      )
    )[0].r;

  it("roll_map: 누를 때마다 새로 뽑고, 밴한 맵은 절대 안 나온다", async () => {
    const { code, host_key } = await createRoom();
    const seen = new Set<string>();
    const rollIds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const r = await rollMap(code, host_key, ["ascent", "lotus"]);
      expect(["ascent", "lotus"]).not.toContain(r.map);
      seen.add(r.map);
      rollIds.add(r.roll_id);
    }
    // 남은 5개 중 여러 맵이 나와야 랜덤 (40번에 1개만 나올 확률은 사실상 0)
    expect(seen.size).toBeGreaterThan(1);
    expect(rollIds.size).toBe(40);

    const saved = await room(code);
    expect(saved.map_bans).toEqual(["ascent", "lotus"]);
    expect(saved.result_map).not.toBeNull();
  });

  it("roll_map: 밴 0개 허용, 3개 이상·중복·풀 밖 맵은 INVALID_BANS", async () => {
    const { code, host_key } = await createRoom();
    await expect(rollMap(code, host_key, [])).resolves.toBeDefined();
    await expectError(
      rollMap(code, host_key, ["ascent", "haven", "lotus"]),
      "INVALID_BANS",
    );
    await expectError(
      rollMap(code, host_key, ["ascent", "ascent"]),
      "INVALID_BANS",
    );
    await expectError(rollMap(code, host_key, ["bind"]), "INVALID_BANS");
    await expectError(rollMap(code, "wrong", []), "FORBIDDEN");
  });

  it("set_map_pool → 남은 맵이 0개면 NO_MAPS_LEFT", async () => {
    const { code, host_key } = await createRoom();
    await asAnon("select set_map_pool($1, $2, $3)", [
      code,
      host_key,
      ["bind", "pearl", "bind"],
    ]);
    expect((await room(code)).map_pool).toEqual(["bind", "pearl"]);
    await expectError(
      rollMap(code, host_key, ["bind", "pearl"]),
      "NO_MAPS_LEFT",
    );
    expect((await rollMap(code, host_key, ["bind"])).map).toBe("pearl");

    await expectError(
      asAnon("select set_map_pool($1, $2, $3)", [code, host_key, []]),
      "INVALID_MAP_POOL",
    );
    await expectError(
      asAnon("select set_map_pool($1, $2, $3)", [code, host_key, ["nope"]]),
      "INVALID_MAP_POOL",
    );
    await expectError(
      asAnon("select set_map_pool($1, 'wrong', $2)", [code, ["bind"]]),
      "FORBIDDEN",
    );
  });

  it("roll_side: 누를 때마다 새로 뽑고 공격·수비 둘 다 나온다", async () => {
    const { code, host_key } = await createRoom();
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const rows = await asAnon<{ s: string }>(
        "select roll_side($1, $2) as s",
        [code, host_key],
      );
      seen.add(rows[0].s);
    }
    expect([...seen].sort()).toEqual(["attack", "defense"]);
    expect(["attack", "defense"]).toContain((await room(code)).side_team1);
    await expectError(
      asAnon("select roll_side($1, 'wrong')", [code]),
      "FORBIDDEN",
    );
  });
});

describe("팀 공유 RPC", () => {
  const teamsOf = async (code: string) =>
    (
      await asAnon<{ team1_ids: string[] | null; team2_ids: string[] | null }>(
        "select team1_ids, team2_ids from rooms where code = $1",
        [code],
      )
    )[0];

  const setTeams = (code: string, key: string, t1: string[], t2: string[]) =>
    asAnon("select set_teams($1, $2, $3::uuid[], $4::uuid[])", [
      code,
      key,
      t1,
      t2,
    ]);

  it("set_teams: 방장만, 이 방 멤버 5명씩 중복 없이 저장하고 누구나 읽는다", async () => {
    const { code, host_key } = await createRoom();
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push((await registerSelf(code, `팀원${i}`)).member_id);
    }
    const [t1, t2] = [ids.slice(0, 5), ids.slice(5)];

    expect(await teamsOf(code)).toEqual({ team1_ids: null, team2_ids: null });
    await setTeams(code, host_key, t1, t2);
    expect(await teamsOf(code)).toEqual({ team1_ids: t1, team2_ids: t2 });

    await expectError(setTeams(code, "wrong", t1, t2), "FORBIDDEN");
    await expectError(
      setTeams(code, host_key, t1.slice(0, 4), t2),
      "INVALID_TEAMS",
    );
    await expectError(
      setTeams(code, host_key, t1, [t1[0], ...t2.slice(1)]),
      "INVALID_TEAMS",
    );

    // 다른 방 멤버는 못 넣는다
    const other = await createRoom();
    const outsider = (await registerSelf(other.code, "외부인")).member_id;
    await expectError(
      setTeams(code, host_key, t1, [outsider, ...t2.slice(1)]),
      "INVALID_TEAMS",
    );
    expect(await teamsOf(code)).toEqual({ team1_ids: t1, team2_ids: t2 });
  });
});
