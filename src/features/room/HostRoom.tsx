"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, IconButton } from "@/components/ui/Button";
import { MoreIcon, RefreshIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Toast, useCopy } from "@/components/ui/Toast";
import { PLAYERS_PER_MATCH, type MapKey } from "@/lib/constants";
import { isRpcError } from "@/lib/supabase/rpc";

import { DiscordChip } from "@/features/discord/DiscordControls";
import { useDiscord } from "@/features/discord/useDiscord";
import { MapBanPanel } from "@/features/map/MapBanPanel";
import { MapPoolForm } from "@/features/map/MapPoolForm";
import { formatBans, MapResultHero } from "@/features/map/MapResult";
import { pruneBans, remainingMaps, toggleBan } from "@/features/map/bans";
import {
  deleteMember as deleteMemberRpc,
  upsertMemberAsHost,
  type HostAuth,
} from "@/features/members/api";
import { MemberForm } from "@/features/members/MemberForm";
import { MemberRow } from "@/features/members/MemberList";
import { TierIcon } from "@/features/members/TierIcon";
import { formatTier } from "@/features/members/tier";
import type { Member, MemberInput } from "@/features/members/types";
import { buildShareText } from "@/features/share/shareText";
import { SideCards, SideCardsCompact } from "@/features/side/SideCards";
import { formatSide, otherSide } from "@/features/side/side";
import { formatScore, teamWarnings } from "@/features/teams/format";
import {
  loadTeamPick,
  nextTeamPick,
  saveTeamPick,
  type TeamPick,
} from "@/features/teams/teamPick";
import {
  restoreSwap,
  sameTeamIds,
  teamIdsOf,
} from "@/features/teams/published";
import { teamReadiness } from "@/features/teams/readiness";
import { pickForSwap, scoreDiffOf } from "@/features/teams/swap";
import { TeamCard, WarningBanner } from "@/features/teams/TeamCard";
import type { TeamResult } from "@/features/teams/types";

import {
  rollMap as rollMapRpc,
  rollSide as rollSideRpc,
  setMapPool,
  setTeams as setTeamsRpc,
  type Room,
} from "./api";
import { queryKeys, useMembers, useRoom, useRoomRealtime } from "./queries";
import { RoomHeader } from "./RoomHeader";
import { RoomError, RoomExpired, RoomLoading } from "./RoomStatus";
import { useHostKey } from "./useHostKey";

type Tab = "team" | "map" | "side";
const TABS: { key: Tab; label: string }[] = [
  { key: "team", label: "팀" },
  { key: "map", label: "맵" },
  { key: "side", label: "공수" },
];

type MapRoll = { map: MapKey; bans: MapKey[] };

type SheetState =
  | { kind: "add" }
  | { kind: "edit"; member: Member }
  | { kind: "pool" }
  | { kind: "ban" }
  | null;

/** 방장 화면 진입: 방 조회 + 방장 키 확인. 키가 없거나 틀리면 참가자 화면으로 (F2-8) */
export function HostRoom({ code }: { code: string }) {
  const router = useRouter();
  const roomQuery = useRoom(code);
  const hostKeyQuery = useHostKey(code);
  const denied = hostKeyQuery.isSuccess && !hostKeyQuery.data;

  useEffect(() => {
    if (denied) router.replace(`/room/${code}`);
  }, [denied, code, router]);

  if (roomQuery.isPending || hostKeyQuery.isPending || denied) {
    return <RoomLoading />;
  }
  if (roomQuery.isError || hostKeyQuery.isError) {
    return (
      <RoomError
        onRetry={() => {
          roomQuery.refetch();
          hostKeyQuery.refetch();
        }}
      />
    );
  }
  if (!roomQuery.data) return <RoomExpired />;
  return (
    <HostDashboard
      room={roomQuery.data}
      host={{ code, hostKey: hostKeyQuery.data! }}
    />
  );
}

/** 방장 화면 — 시안 Host / Teams / MapBan / Side (모바일 탭), PcHost (PC 대시보드) */
/** 테스트에서 직접 렌더 (방·방장 키 확인이 끝난 뒤의 화면) */
export function HostDashboard({ room, host }: { room: Room; host: HostAuth }) {
  const { code } = room;
  const queryClient = useQueryClient();
  const membersQuery = useMembers(room.id);
  const connected = useRoomRealtime(room);
  const members = membersQuery.data ?? [];

  // 팀 결과는 방장 브라우저에 저장 → 새로고침해도 유지, [팀 다시 짜기] 를 눌러야만 바뀐다 (F5-4, F5-5).
  // HostDashboard 는 방 조회가 끝난 뒤 클라이언트에서만 그려지므로 초기값에서 localStorage 를 읽어도 된다
  const [teamPick, setTeamPick] = useState<TeamPick | null>(() =>
    loadTeamPick(code),
  );
  const generated = teamPick ? teamPick.options[teamPick.index] : null;

  // 선수 교체(F5-6): null 이면 자동 생성 결과 그대로.
  // localStorage 에는 저장하지 않지만 참가자에게 공유된 구성(rooms)으로 새로고침 후 복원한다
  const [swapped, setSwapped] = useState<TeamResult | null>(() =>
    restoreSwap(generated, room.teamIds),
  );
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelected, setSwapSelected] = useState<string | null>(null);
  const teams: TeamResult | null = swapped ?? generated;

  // 맵 풀 · 맵 결과 · 공수는 서버(rooms) 값. 밴 선택만 방장 화면 상태 (F6-2)
  const pool = room.mapPool;
  const [banSelection, setBans] = useState<MapKey[]>([]);
  const bans = pruneBans(banSelection, pool);
  const mapRoll: MapRoll | null = room.resultMap
    ? { map: room.resultMap, bans: room.mapBans }
    : null;
  const side = room.sideTeam1;

  const [tab, setTab] = useState<Tab>("team");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** [저장하고 하나 더] 마다 바꿔서 추가 폼을 새로 그린다 (비우고 닉네임에 포커스) */
  const [addFormKey, setAddFormKey] = useState(0);
  const { toast, copy, show } = useCopy();

  const readiness = teamReadiness(members);
  const shareText = buildShareText({ map: mapRoll?.map ?? null, side, teams });

  const refreshMembers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.members(room.id) });
  const refreshRoom = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.room(code) });
  const refreshAll = () => {
    refreshMembers();
    refreshRoom();
  };

  // 디스코드 자동 전송 (F10). 기능 플래그가 꺼져 있으면 아무것도 안 그리고 안 보낸다
  const discord = useDiscord({
    host,
    guildName: room.discordGuildName ?? null,
    toast: show,
    onChanged: refreshRoom,
  });
  /** 지금 정해져 있는 것 (새 결과가 나오기 직전 상태) — 자동 전송이 all / 개별을 고른다 */
  const decided = {
    teams: !!teams,
    map: !!room.resultMap,
    side: !!room.sideTeam1,
  };
  /** [선수 교체] 를 눌렀을 때의 구성 — [완료] 때 바뀌었으면 자동 전송 */
  const swapStartIds = useRef<string | null>(null);
  const idsKey = (t: TeamResult) => JSON.stringify(teamIdsOf(t));

  const closeSheet = () => {
    setSheet(null);
    setFormError(null);
  };

  /** RPC 공통 처리: 중복 클릭 막기 + 에러 안내 + 목록 갱신 */
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      if (isRpcError(e, "NICKNAME_TAKEN"))
        setFormError("이미 있는 닉네임이에요");
      else if (isRpcError(e, "FORBIDDEN")) show("방장 키가 맞지 않아요");
      else if (isRpcError(e, "NO_MAPS_LEFT")) show("남은 맵이 없어요");
      else if (isRpcError(e, "INVALID_BANS"))
        show("밴은 맵 풀 안에서 2개까지만 고를 수 있어요");
      else show("저장하지 못했어요. 잠시 후 다시 시도해주세요");
    } finally {
      setBusy(false);
      refreshAll();
    }
  };

  /** next: [저장하고 하나 더] — 시트는 열어 둔 채 폼만 비운다 */
  const saveMember = (
    input: MemberInput,
    id?: string,
    { next = false }: { next?: boolean } = {},
  ) =>
    run(async () => {
      await upsertMemberAsHost(host, input, id);
      if (next) {
        setFormError(null);
        setAddFormKey((k) => k + 1);
        show(`${input.nickname} 추가했어요`);
      } else {
        closeSheet();
      }
    });

  // 방장 화면의 팀 결과를 참가자 화면에 공유 (F5-7). 연속 교체 순서가 뒤집히지 않게 차례로 보낸다
  const publishQueue = useRef(Promise.resolve());
  const publishTeams = (result: TeamResult, { quiet = false } = {}) => {
    const ids = teamIdsOf(result);
    publishQueue.current = publishQueue.current
      .then(() => setTeamsRpc(host, ids))
      .catch(() => {
        if (!quiet) show("참가자에게 팀을 공유하지 못했어요");
      });
  };

  // 화면을 열 때 한 번: 저장된 팀이 아직 공유 안 됐거나 다르면 공유 (기능 추가 전에 짠 팀 등).
  // 저장된 팀에 삭제된 멤버가 있으면 서버가 거절하므로 조용히 넘어간다
  const syncedOnMount = useRef(false);
  useEffect(() => {
    if (syncedOnMount.current) return;
    syncedOnMount.current = true;
    if (
      teams &&
      !(room.teamIds && sameTeamIds(room.teamIds, teamIdsOf(teams)))
    ) {
      publishTeams(teams, { quiet: true });
    }
  });

  const deleteMember = (id: string) =>
    run(async () => {
      await deleteMemberRpc(host, id);
      closeSheet();
    });

  const resetSwap = () => {
    setSwapped(null);
    setSwapMode(false);
    setSwapSelected(null);
  };

  const makeTeams = () => {
    const next = nextTeamPick(teamPick, members);
    setTeamPick(next);
    saveTeamPick(code, next);
    resetSwap();
    const result = next.options[next.index];
    publishTeams(result);
    discord.autoSend("teams", result, decided);
  };

  const startSwap = () => {
    swapStartIds.current = teams && idsKey(teams);
    setSwapMode(true);
  };

  const finishSwap = () => {
    setSwapMode(false);
    setSwapSelected(null);
    if (teams && idsKey(teams) !== swapStartIds.current) {
      discord.autoSend("teams", teams, decided);
    }
  };

  const pickPlayer = (memberId: string) => {
    if (!teams) return;
    const next = pickForSwap(
      { result: teams, selectedId: swapSelected },
      memberId,
    );
    if (next.result !== teams) {
      setSwapped(next.result);
      publishTeams(next.result);
    }
    setSwapSelected(next.selectedId);
  };

  /** 자동 생성 직후 결과로 복원 */
  const undoSwap = () => {
    setSwapped(null);
    setSwapSelected(null);
    if (generated) publishTeams(generated);
  };

  /** 누를 때마다 서버에서 새로 뽑는다 (F6-3, F6-4) */
  const rollMap = () =>
    run(async () => {
      if (!remainingMaps(pool, bans).length) return;
      await rollMapRpc(host, bans);
      setSheet(null);
      discord.autoSend("map", teams, decided);
    });

  /** 누를 때마다 서버에서 새로 뽑는다 (F7-1, F7-3) */
  const rollSide = () =>
    run(async () => {
      await rollSideRpc(host);
      discord.autoSend("side", teams, decided);
    });

  const savePool = (next: MapKey[]) =>
    run(async () => {
      await setMapPool(host, next);
      setBans((b) => pruneBans(b, next));
      closeSheet();
    });

  const copyJoinLink = () =>
    copy(`${location.origin}/join/${code}`, "참가 링크를 복사했어요");
  const copyHostLink = () =>
    copy(
      `${location.origin}/room/${code}/host#key=${host.hostKey}`,
      "방장 링크를 복사했어요",
    );
  const copyShare = () => copy(shareText);

  const memberMenu = (m: Member) => (
    <IconButton
      aria-label={`${m.nickname} 수정`}
      className="text-faint -mr-2 w-9"
      onClick={() => setSheet({ kind: "edit", member: m })}
    >
      <MoreIcon size={18} />
    </IconButton>
  );

  const memberListHeader = (
    <div className="flex items-center justify-between pb-2">
      <h2 className="text-[15px] font-semibold">
        멤버{" "}
        <span
          className={`font-normal ${members.length === PLAYERS_PER_MATCH ? "text-muted" : "text-danger"}`}
        >
          {members.length}/{PLAYERS_PER_MATCH}
        </span>
      </h2>
      <Button size="sm" onClick={() => setSheet({ kind: "add" })}>
        + 추가
      </Button>
    </div>
  );

  const missingIds = new Set(
    readiness.ready ? [] : readiness.missingTier.map((m) => m.id),
  );
  const warnings = teams ? teamWarnings(teams.teams) : [];

  const teamButton = (className = "") => (
    <Button
      variant="primary"
      size="lg"
      className={`w-full ${className}`}
      disabled={!readiness.ready}
      onClick={makeTeams}
    >
      {teams ? "팀 다시 짜기" : "팀 짜기"}
    </Button>
  );

  const readinessHint = (
    <p className="text-muted text-center text-[13px]">
      {readiness.ready ? (
        teamPick && teams ? (
          swapped ? (
            `선수 교체함 · 점수 차 ${formatScore(scoreDiffOf(teams))} · 다시 짜면 교체가 초기화돼요`
          ) : (
            `${teamPick.index + 1}/${teamPick.options.length}번째 조합 · 점수 차 ${formatScore(scoreDiffOf(teams))} · 다시 누르면 다음 조합`
          )
        ) : (
          "멤버 10명으로 5:5를 나눠요"
        )
      ) : (
        <span className="text-danger">{readiness.message}</span>
      )}
    </p>
  );

  /** [선수 교체] / 교체 모드 안내 + [완료] / [되돌리기] */
  const swapToolbar = teams && (
    <div
      className={`flex items-center gap-2 ${swapMode ? "bg-accent-soft rounded-xl px-3.5 py-2" : ""}`}
    >
      {swapMode ? (
        <p role="status" className="text-fg min-w-0 flex-1 text-sm">
          바꿀 두 명을 차례로 선택하세요
        </p>
      ) : (
        <span className="flex-1" />
      )}
      {swapped && (
        <Button size="sm" variant="ghost" onClick={undoSwap}>
          되돌리기
        </Button>
      )}
      {swapMode ? (
        <Button size="sm" variant="light" onClick={finishSwap}>
          완료
        </Button>
      ) : (
        <Button size="sm" onClick={startSwap}>
          선수 교체
        </Button>
      )}
    </div>
  );

  const swapProps = swapMode
    ? { selectedId: swapSelected, onPick: pickPlayer }
    : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-3.5 px-5 pt-4 lg:p-0">
        <RoomHeader
          code={code}
          userType="host"
          connected={connected}
          actions={
            <>
              <div className="hidden items-center gap-3 lg:flex">
                <DiscordChip discord={discord} />
                <Button variant="surface" onClick={copyJoinLink}>
                  참가 링크 복사
                </Button>
                <Button
                  variant="surface"
                  className="text-muted"
                  onClick={copyHostLink}
                >
                  방장 링크 복사
                </Button>
                <IconButton
                  aria-label="새로고침"
                  className="border-line bg-surface rounded-[10px] border"
                  onClick={refreshAll}
                >
                  <RefreshIcon size={18} />
                </IconButton>
                <Button variant="primary" onClick={copyShare}>
                  디코용 복사
                </Button>
              </div>
              <span className="lg:hidden">
                <DiscordChip discord={discord} />
              </span>
              <IconButton
                aria-label="새로고침"
                className="-mr-2.5 lg:hidden"
                onClick={refreshAll}
              >
                <RefreshIcon />
              </IconButton>
            </>
          }
        />

        {/* 모바일: 링크 복사 + 탭 */}
        <div className="flex gap-2 lg:hidden">
          <Button variant="surface" className="flex-1" onClick={copyJoinLink}>
            참가 링크 복사
          </Button>
          <Button
            variant="surface"
            className="text-muted flex-1"
            onClick={copyHostLink}
          >
            방장 링크 복사
          </Button>
        </div>
        <div role="tablist" className="border-line flex border-b lg:hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`h-12 flex-1 cursor-pointer border-b-2 text-[15px] ${tab === t.key ? "border-accent text-fg font-semibold" : "text-muted border-transparent font-medium"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───────── 모바일 탭 콘텐츠 ───────── */}
      <div className="flex flex-1 flex-col lg:hidden">
        {tab === "team" && (
          <>
            <div className="flex flex-1 flex-col gap-4 px-5 py-4">
              {teams && (
                <section className="flex flex-col gap-3.5">
                  {warnings.map((w) => (
                    <WarningBanner key={w} message={w} />
                  ))}
                  {swapToolbar}
                  <TeamCard
                    team={teams.teams[0]}
                    index={0}
                    swap={swapProps}
                    side={side}
                  />
                  <TeamCard
                    team={teams.teams[1]}
                    index={1}
                    swap={swapProps}
                    side={side && otherSide(side)}
                  />
                  <Button
                    size="lg"
                    className="w-full text-base"
                    onClick={copyShare}
                  >
                    디코용 복사
                  </Button>
                </section>
              )}
              <section>
                {memberListHeader}
                <ul>
                  {members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      highlight={missingIds.has(m.id)}
                      trailing={memberMenu(m)}
                    />
                  ))}
                </ul>
              </section>
            </div>
            <div className="border-line bg-bg-sunken sticky bottom-0 flex flex-col gap-2.5 border-t px-5 pt-4 pb-7">
              {readinessHint}
              {teamButton()}
            </div>
          </>
        )}

        {tab === "map" && (
          <div className="flex flex-1 flex-col gap-4 px-5 py-4">
            {mapRoll && (
              <div className="bg-surface overflow-hidden rounded-[14px]">
                <MapResultHero map={mapRoll.map} className="h-[120px]" />
                <p className="text-muted px-4 py-3 text-[13px]">
                  밴{" "}
                  <span className="text-fg font-semibold">
                    {formatBans(mapRoll.bans)}
                  </span>
                </p>
              </div>
            )}
            <MapBanPanel
              pool={pool}
              bans={bans}
              onToggle={(m) => setBans((b) => toggleBan(b, m))}
              rolled={!!mapRoll}
              rolling={busy}
              onRoll={rollMap}
              onEditPool={() => setSheet({ kind: "pool" })}
            />
          </div>
        )}

        {tab === "side" && (
          <div className="flex flex-1 flex-col gap-4 px-5 py-4">
            <h2 className="text-[17px] font-semibold">공수</h2>
            <div className="flex flex-col gap-2">
              <span className="text-muted text-[13px]">팀1 시작 진영</span>
              <SideCards team1={side} />
              <p className="mt-1 text-center text-base font-semibold">
                {side ? formatSide(side) : "아직 안 정했어요"}
              </p>
            </div>
            <Button
              size="lg"
              className="h-[52px] w-full text-base"
              onClick={rollSide}
            >
              {side ? "공수 다시 돌리기" : "공수 랜덤"}
            </Button>
            <div className="mt-2 flex flex-col gap-2">
              <span className="text-muted text-[13px]">디코용 미리보기</span>
              <pre className="bg-surface text-fg-2 rounded-xl p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
                {shareText}
              </pre>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="mt-auto w-full"
              onClick={copyShare}
            >
              디코용 복사
            </Button>
          </div>
        )}
      </div>

      {/* ───────── PC 대시보드 ───────── */}
      <div className="mx-auto hidden w-full max-w-[1360px] items-start gap-6 px-8 pt-6 pb-10 lg:flex">
        <aside className="border-line-subtle bg-panel flex w-[360px] shrink-0 flex-col rounded-2xl border">
          <div className="px-4 pt-4 pl-5">{memberListHeader}</div>
          <ul className="px-2">
            {members.map((m) => (
              <li
                key={m.id}
                className={`flex h-12 items-center gap-3 rounded-[10px] pr-1 pl-3 ${missingIds.has(m.id) ? "bg-accent-soft/60" : ""}`}
              >
                <TierIcon tier={m.currentTier} size={26} />
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {m.nickname}
                </span>
                <span
                  className={`text-[13px] ${m.currentTier ? "text-muted" : "text-danger"}`}
                >
                  {m.currentTier ? formatTier(m.currentTier) : "정보 미입력"}
                </span>
                {memberMenu(m)}
              </li>
            ))}
          </ul>
          <div className="border-line-subtle mt-2 flex flex-col gap-2.5 border-t px-5 pt-4 pb-5">
            {readinessHint}
            {teamButton("h-[52px] text-base")}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {teams ? (
            <div className="flex flex-col gap-3">
              {swapToolbar}
              <div className="grid grid-cols-2 gap-4">
                <TeamCard
                  team={teams.teams[0]}
                  index={0}
                  swap={swapProps}
                  side={side}
                />
                <TeamCard
                  team={teams.teams[1]}
                  index={1}
                  swap={swapProps}
                  side={side && otherSide(side)}
                />
              </div>
            </div>
          ) : (
            <div className="border-line flex h-[200px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed text-center">
              <span className="text-[15px] font-semibold">
                아직 팀을 안 짰어요
              </span>
              <span className="text-muted text-[13px]">
                멤버 10명을 채우고 왼쪽 [팀 짜기]를 눌러주세요
              </span>
            </div>
          )}

          <div className="flex gap-4">
            <section className="bg-surface flex min-w-0 flex-[2_1_360px] flex-col overflow-hidden rounded-2xl">
              {mapRoll ? (
                <MapResultHero map={mapRoll.map} />
              ) : (
                <div className="bg-surface-active text-muted flex h-[180px] items-center justify-center text-sm">
                  아직 맵을 안 돌렸어요
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <span className="text-muted text-[13px]">
                  밴{" "}
                  <span className="text-fg font-semibold">
                    {mapRoll ? formatBans(mapRoll.bans) : "—"}
                  </span>
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    className="h-10 text-[13px]"
                    onClick={() => setSheet({ kind: "pool" })}
                  >
                    맵 풀 설정
                  </Button>
                  <Button
                    className="h-10 text-[13px]"
                    onClick={() => setSheet({ kind: "ban" })}
                  >
                    {mapRoll ? "밴 · 다시 돌리기" : "밴 · 맵 랜덤"}
                  </Button>
                </div>
              </div>
            </section>

            <section className="bg-surface flex flex-[1_1_260px] flex-col gap-3.5 rounded-2xl p-5">
              <h2 className="text-muted text-[13px]">공수</h2>
              <SideCardsCompact team1={side} />
              <Button className="w-full font-semibold" onClick={rollSide}>
                {side ? "공수 다시 돌리기" : "공수 랜덤"}
              </Button>
            </section>
          </div>
        </div>
      </div>

      {/* ───────── 시트 ───────── */}
      <Sheet
        open={sheet?.kind === "add"}
        title="멤버 추가"
        onClose={closeSheet}
        mobile="bottom"
      >
        <MemberForm
          key={addFormKey}
          autoFocus
          submitLabel={busy ? "저장 중…" : "저장"}
          error={formError}
          onSubmit={(v) => saveMember(v)}
          onSubmitAndNext={(v) => saveMember(v, undefined, { next: true })}
        />
      </Sheet>
      <Sheet
        open={sheet?.kind === "edit"}
        title="멤버 수정"
        onClose={closeSheet}
      >
        {sheet?.kind === "edit" && (
          <>
            <MemberForm
              key={sheet.member.id}
              initial={sheet.member}
              error={formError}
              onSubmit={(v) => saveMember(v, sheet.member.id)}
            />
            <button
              type="button"
              onClick={() => deleteMember(sheet.member.id)}
              className="text-danger mt-3 h-11 cursor-pointer text-sm"
            >
              멤버 삭제
            </button>
          </>
        )}
      </Sheet>
      <Sheet
        open={sheet?.kind === "pool"}
        title="맵 풀 설정"
        onClose={closeSheet}
      >
        <MapPoolForm initial={pool} onSubmit={savePool} />
      </Sheet>
      <Sheet open={sheet?.kind === "ban"} title="맵 밴" onClose={closeSheet}>
        <MapBanPanel
          showTitle={false}
          pool={pool}
          bans={bans}
          onToggle={(m) => setBans((b) => toggleBan(b, m))}
          rolled={!!mapRoll}
          rolling={busy}
          onRoll={rollMap}
          onEditPool={() => setSheet({ kind: "pool" })}
        />
      </Sheet>

      <Toast message={toast} />
    </div>
  );
}
