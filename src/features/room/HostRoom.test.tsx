// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_MEMBERS } from "@/lib/dev/fixtures";
import { RpcError } from "@/lib/supabase/rpc";

import { upsertMemberAsHost } from "@/features/members/api";
import type { Member, MemberInput } from "@/features/members/types";
import { buildShareText } from "@/features/share/shareText";
import { formatScore, playerPositionLabel } from "@/features/teams/format";
import { generateTeams } from "@/features/teams/generateTeams";
import { swapPlayers } from "@/features/teams/swap";
import { teamIdsOf } from "@/features/teams/published";
import { loadTeamPick } from "@/features/teams/teamPick";

import { setTeams, type Room } from "./api";
import { HostDashboard } from "./HostRoom";

/** 멤버 목록 — useMembers 대신 메모리 저장소 (바뀌면 다시 그림) */
const store = vi.hoisted(() => {
  let members: unknown[] = [];
  const listeners = new Set<() => void>();
  return {
    get: () => members,
    set(next: unknown[]) {
      members = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});

vi.mock("./queries", async () => {
  const React = await import("react");
  return {
    queryKeys: {
      members: (id: string) => ["members", id],
      room: (code: string) => ["room", code],
    },
    useMembers: () => ({
      data: React.useSyncExternalStore(store.subscribe, store.get),
    }),
    useRoomRealtime: () => true,
  };
});

vi.mock("@/features/members/api", () => ({
  upsertMemberAsHost: vi.fn(),
  deleteMember: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  setTeams: vi.fn(async () => {}),
  rollSide: vi.fn(async () => "attack"),
}));

const upsert = vi.mocked(upsertMemberAsHost);
const publish = vi.mocked(setTeams);
const clipboard = { writeText: vi.fn(async (text: string) => void text) };

const ROOM = {
  id: "room-1",
  code: "ABC123",
  mapPool: ["ascent"],
  mapBans: [],
  resultMap: null,
  sideTeam1: null,
  teamIds: null,
} as unknown as Room;

/** 10명 모두 티어 입력 */
const TEN: Member[] = DEMO_MEMBERS.map((m) =>
  m.currentTier ? m : { ...m, currentTier: "silver_2" },
);

function renderHost(members: Member[], room: Room = ROOM) {
  store.set(members);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <HostDashboard room={room} host={{ code: "ABC123", hostKey: "k" }} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  publish.mockClear();
  upsert.mockReset();
  upsert.mockImplementation(async (_host, input: MemberInput) => {
    const list = store.get() as Member[];
    if (list.some((m) => m.nickname === input.nickname)) {
      throw new RpcError("NICKNAME_TAKEN", "NICKNAME_TAKEN");
    }
    const id = `new-${list.length}`;
    store.set([...list, { id, ...input }]);
    return id;
  });
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });
  clipboard.writeText.mockClear();
});
afterEach(cleanup);

/* ───────────────────────── 1. 멤버 추가 ───────────────────────── */

const openAdd = () =>
  fireEvent.click(screen.getAllByRole("button", { name: "+ 추가" })[0]);
const addDialog = () => screen.getByRole("dialog", { name: "멤버 추가" });

function fillForm(nickname: string) {
  const dialog = addDialog();
  fireEvent.change(within(dialog).getByLabelText("닉네임"), {
    target: { value: nickname },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: /^골드$/ }));
}

describe("방장 멤버 추가", () => {
  it("일괄 등록은 없고 [추가] 하나만", () => {
    renderHost([]);
    expect(screen.queryByRole("button", { name: "일괄 등록" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "+ 추가" }).length).toBe(2); // 모바일·PC
  });

  it("추가 → 정보 입력 → 저장 → 목록 반영, 시트 닫힘", async () => {
    renderHost([]);
    openAdd();
    expect(document.activeElement).toBe(
      within(addDialog()).getByLabelText("닉네임"),
    );
    fillForm("새멤버");
    await act(async () => {
      fireEvent.click(
        within(addDialog()).getByRole("button", { name: "저장" }),
      );
    });

    expect(upsert).toHaveBeenCalledWith(
      { code: "ABC123", hostKey: "k" },
      expect.objectContaining({ nickname: "새멤버", currentTier: "gold_1" }),
      undefined,
    );
    expect(screen.queryByRole("dialog", { name: "멤버 추가" })).toBeNull();
    expect(screen.getAllByText("새멤버").length).toBeGreaterThan(0);
  });

  it("저장하고 하나 더 → 저장 후 폼 비우고 닉네임에 포커스, 시트 유지", async () => {
    renderHost([]);
    openAdd();
    fillForm("첫째");
    await act(async () => {
      fireEvent.click(
        within(addDialog()).getByRole("button", { name: "저장하고 하나 더" }),
      );
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    const nickname =
      within(addDialog()).getByLabelText<HTMLInputElement>("닉네임");
    expect(nickname.value).toBe("");
    expect(document.activeElement).toBe(nickname);

    fillForm("둘째");
    await act(async () => {
      fireEvent.click(
        within(addDialog()).getByRole("button", { name: "저장하고 하나 더" }),
      );
    });
    expect((store.get() as Member[]).map((m) => m.nickname)).toEqual([
      "첫째",
      "둘째",
    ]);
  });

  it("닉네임 중복이면 에러 표시, 입력값 유지", async () => {
    renderHost([TEN[0]]);
    openAdd();
    fillForm(TEN[0].nickname);
    await act(async () => {
      fireEvent.click(
        within(addDialog()).getByRole("button", { name: "저장하고 하나 더" }),
      );
    });
    expect(
      within(addDialog()).getByText("이미 있는 닉네임이에요"),
    ).toBeDefined();
    expect(
      within(addDialog()).getByLabelText<HTMLInputElement>("닉네임").value,
    ).toBe(TEN[0].nickname);
  });
});

/* ───────────────────────── 2. 선수 교체 ───────────────────────── */

/** 모바일 레이아웃(먼저 그려짐)의 팀 카드 */
const teamCard = (name: "팀1" | "팀2") =>
  screen.getAllByRole("region", { name })[0];
const playerButton = (name: "팀1" | "팀2", nickname: string) =>
  within(teamCard(name)).getByRole("button", { name: new RegExp(nickname) });
const namesIn = (name: "팀1" | "팀2") =>
  within(teamCard(name))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");

function startSwap() {
  renderHost(TEN);
  fireEvent.click(screen.getAllByRole("button", { name: "팀 짜기" })[0]);
  fireEvent.click(screen.getAllByRole("button", { name: "선수 교체" })[0]);
  const base = generateTeams(TEN);
  return {
    base,
    a: base.teams[0].players[0].member,
    a2: base.teams[0].players[1].member,
    b: base.teams[1].players[0].member,
  };
}

describe("팀 결과 선수 교체", () => {
  it("교체 모드: 안내 문구, 행은 버튼, 첫 선택은 aria-pressed", () => {
    const { a } = startSwap();
    expect(screen.getAllByText("바꿀 두 명을 차례로 선택하세요").length).toBe(
      2,
    );
    fireEvent.click(playerButton("팀1", a.nickname));
    expect(playerButton("팀1", a.nickname).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("다른 팀 두 명 교체 → 점수·포지션 다시 계산", () => {
    const { base, a, b } = startSwap();
    fireEvent.click(playerButton("팀1", a.nickname));
    fireEvent.click(playerButton("팀2", b.nickname));

    const expected = swapPlayers(base, a.id, b.id);
    expect(namesIn("팀1").some((t) => t.includes(b.nickname))).toBe(true);
    expect(namesIn("팀2").some((t) => t.includes(a.nickname))).toBe(true);

    for (const [i, name] of [
      [0, "팀1"],
      [1, "팀2"],
    ] as const) {
      expect(teamCard(name).textContent).toContain(
        formatScore(expected.teams[i].score),
      );
      for (const p of expected.teams[i].players) {
        const row = playerButton(name, p.member.nickname);
        expect(row.textContent).toContain(playerPositionLabel(p));
      }
    }
    // 교체 뒤 선택은 풀린다
    expect(
      within(teamCard("팀1")).queryAllByRole("button", { pressed: true }),
    ).toHaveLength(0);
  });

  it("같은 팀 재선택 → 선택만 바뀜, 같은 사람 다시 → 해제", () => {
    const { a, a2 } = startSwap();
    fireEvent.click(playerButton("팀1", a.nickname));
    fireEvent.click(playerButton("팀1", a2.nickname));
    expect(playerButton("팀1", a.nickname).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(playerButton("팀1", a2.nickname).getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.click(playerButton("팀1", a2.nickname));
    expect(
      within(teamCard("팀1")).queryAllByRole("button", { pressed: true }),
    ).toHaveLength(0);
  });

  it("되돌리기 → 자동 생성 결과, 완료 → 교체 모드 종료", () => {
    const { base, a, b } = startSwap();
    fireEvent.click(playerButton("팀1", a.nickname));
    fireEvent.click(playerButton("팀2", b.nickname));

    fireEvent.click(screen.getAllByRole("button", { name: "되돌리기" })[0]);
    expect(namesIn("팀1").some((t) => t.includes(a.nickname))).toBe(true);
    expect(teamCard("팀1").textContent).toContain(
      formatScore(base.teams[0].score),
    );
    expect(screen.queryAllByRole("button", { name: "되돌리기" })).toHaveLength(
      0,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "완료" })[0]);
    expect(
      screen.queryAllByText("바꿀 두 명을 차례로 선택하세요"),
    ).toHaveLength(0);
    expect(
      within(teamCard("팀1")).queryAllByRole("button", {
        name: new RegExp(a.nickname),
      }),
    ).toHaveLength(0);
  });

  it("디코용 복사는 교체된 결과 기준", async () => {
    const { base, a, b } = startSwap();
    fireEvent.click(playerButton("팀1", a.nickname));
    fireEvent.click(playerButton("팀2", b.nickname));

    await act(async () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: "디코용 복사" })[0],
      );
    });
    const expected = buildShareText({
      map: null,
      side: null,
      teams: swapPlayers(base, a.id, b.id),
    });
    expect(clipboard.writeText).toHaveBeenCalledWith(expected);
  });

  it("교체 결과는 저장하지 않는다 (자동 생성 결과만 localStorage)", () => {
    const { base, a, b } = startSwap();
    fireEvent.click(playerButton("팀1", a.nickname));
    fireEvent.click(playerButton("팀2", b.nickname));
    const ids = (r: { teams: { players: { member: { id: string } }[] }[] }) =>
      r.teams.map((t) => t.players.map((p) => p.member.id).sort());
    const saved = loadTeamPick("ABC123")!;
    expect(ids(saved.options[saved.index])).toEqual(ids(base));
    expect(ids(saved.options[saved.index])).not.toEqual(
      ids(swapPlayers(base, a.id, b.id)),
    );
  });

  it("팀 짜기 · 교체 · 되돌리기마다 참가자에게 공유한다 (F5-7)", async () => {
    const { base, a, b } = startSwap();
    const host = { code: "ABC123", hostKey: "k" };
    fireEvent.click(playerButton("팀1", a.nickname));
    fireEvent.click(playerButton("팀2", b.nickname));
    fireEvent.click(screen.getAllByRole("button", { name: "되돌리기" })[0]);
    await act(async () => {});

    expect(publish.mock.calls).toEqual([
      [host, teamIdsOf(base)],
      [host, teamIdsOf(swapPlayers(base, a.id, b.id))],
      [host, teamIdsOf(base)],
    ]);
  });

  it("새로고침하면 공유된 구성으로 교체 결과를 복원", () => {
    const { base, a, b } = startSwap();
    cleanup();
    const swapped = swapPlayers(base, a.id, b.id);
    renderHost(TEN, { ...ROOM, teamIds: teamIdsOf(swapped) });

    expect(namesIn("팀1").some((t) => t.includes(b.nickname))).toBe(true);
    expect(screen.getAllByRole("button", { name: "되돌리기" }).length).toBe(2);
  });

  it("저장된 팀이 아직 공유 안 됐으면 화면을 열 때 한 번 공유", async () => {
    const { base } = startSwap();
    await act(async () => {}); // [팀 짜기] 공유가 끝날 때까지
    cleanup();
    publish.mockClear();

    renderHost(TEN);
    await act(async () => {});
    expect(publish.mock.calls).toEqual([
      [{ code: "ABC123", hostKey: "k" }, teamIdsOf(base)],
    ]);

    // 이미 같은 구성이 공유돼 있으면 다시 보내지 않는다
    cleanup();
    publish.mockClear();
    renderHost(TEN, { ...ROOM, teamIds: teamIdsOf(base) });
    await act(async () => {});
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("방 코드", () => {
  it("누르면 코드만 복사", async () => {
    renderHost(TEN);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "방 코드 ABC123 복사" }),
      );
    });
    expect(clipboard.writeText).toHaveBeenLastCalledWith("ABC123");
    expect(screen.getByText("방 코드를 복사했어요")).toBeTruthy();
  });
});

/* ───────────────────────── 디스코드 (F10) ───────────────────────── */

describe("디스코드", () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ ok: true })),
  );
  const sends = () =>
    fetchMock.mock.calls
      .filter(([url]) => url === "/api/discord/send")
      .map(([, init]) => JSON.parse(String(init?.body)));

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_ENABLED", "true");
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** 연결됐고 맵 · 공수가 이미 정해진 방 */
  const decidedRoom = {
    ...ROOM,
    discordGuildName: "우리",
    resultMap: "ascent",
    sideTeam1: "attack",
  } as Room;

  const makeTeams = async () => {
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: /팀 (다시 )?짜기/ })[0],
      );
    });
  };

  it("기능 플래그가 꺼져 있으면 디스코드 UI 가 없다", () => {
    vi.stubEnv("NEXT_PUBLIC_DISCORD_ENABLED", "false");
    renderHost(TEN, decidedRoom);
    expect(screen.queryAllByText(/디스코드/)).toHaveLength(0);
  });

  it("[디코로 보내기] 버튼은 없다", () => {
    renderHost(TEN, decidedRoom);
    expect(
      screen.queryAllByRole("button", { name: "디코로 보내기" }),
    ).toHaveLength(0);
  });

  it("미연결: [디스코드 연결] 표시, 팀을 짜도 보내지 않는다", async () => {
    renderHost(TEN, { ...decidedRoom, discordGuildName: null } as Room);
    expect(
      screen.getAllByRole("button", { name: "디스코드 연결" }).length,
    ).toBeGreaterThan(0);
    await makeTeams();
    expect(sends()).toHaveLength(0);
  });

  it("맵 · 공수가 아직이면 팀을 짜도 보내지 않는다", async () => {
    renderHost(TEN, { ...ROOM, discordGuildName: "우리" } as Room);
    expect(screen.getAllByText("우리 서버 연결됨").length).toBeGreaterThan(0);
    await makeTeams();
    expect(sends()).toHaveLength(0);
  });

  it("팀 · 맵 · 공수가 다 정해지면 all 로 한 번에 보낸다", async () => {
    renderHost(TEN, decidedRoom);
    await makeTeams();
    expect(sends()).toHaveLength(1);
    expect(sends()[0]).toMatchObject({
      code: "ABC123",
      hostKey: "k",
      kind: "all",
    });
    expect(sends()[0].teams).toHaveLength(2);
    expect(screen.getByText("디스코드로 보냈어요")).toBeTruthy();
  });

  it("팀 · 맵이 있고 공수를 돌리면 그때 보낸다", async () => {
    renderHost(TEN, { ...decidedRoom, sideTeam1: null } as Room);
    await makeTeams();
    expect(sends()).toHaveLength(0);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "공수 랜덤" })[0]);
    });
    expect(sends()).toHaveLength(1);
    expect(sends()[0].kind).toBe("all");
  });

  it("선수 교체 [완료]: 구성이 바뀌었을 때만 팀만 보낸다", async () => {
    const { a, b } = startSwap();
    cleanup();
    renderHost(TEN, decidedRoom);
    await act(async () => {});
    fetchMock.mockClear();

    fireEvent.click(screen.getAllByRole("button", { name: "선수 교체" })[0]);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "완료" })[0]);
    });
    expect(sends()).toHaveLength(0);

    fireEvent.click(screen.getAllByRole("button", { name: "선수 교체" })[0]);
    fireEvent.click(playerButton("팀1", a.nickname));
    fireEvent.click(playerButton("팀2", b.nickname));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "완료" })[0]);
    });
    expect(sends()).toHaveLength(1);
    expect(sends()[0].kind).toBe("teams");
  });

  it("셋 다 정해진 뒤에는 바뀐 것만: 팀 다시 짜기 → teams, 공수 다시 돌리기 → side", async () => {
    renderHost(TEN, decidedRoom);
    await makeTeams(); // 처음 갖춰짐 → all
    await makeTeams(); // 다시 짜기
    expect(sends().map((b) => b.kind)).toEqual(["all", "teams"]);
    expect(sends()[1].teams).toHaveLength(2);

    await act(async () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: "공수 다시 돌리기" })[0],
      );
    });
    expect(sends().map((b) => b.kind)).toEqual(["all", "teams", "side"]);
    expect(sends()[2].teams).toBeUndefined();
  });

  it("자동 전송을 끄면(localStorage) 보내지 않는다", async () => {
    localStorage.setItem("discord_auto:ABC123", "off");
    renderHost(TEN, decidedRoom);
    await makeTeams();
    expect(sends()).toHaveLength(0);
  });
});
