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
