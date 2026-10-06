"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, IconButton } from "@/components/ui/Button";
import { MoreIcon, RefreshIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Toast, useCopy } from "@/components/ui/Toast";
import { PLAYERS_PER_MATCH, type MapKey } from "@/lib/constants";
import { isRpcError } from "@/lib/supabase/rpc";

import { MapBanPanel } from "@/features/map/MapBanPanel";
import { MapPoolForm } from "@/features/map/MapPoolForm";
import { formatBans, MapResultHero } from "@/features/map/MapResult";
import { pruneBans, remainingMaps, toggleBan } from "@/features/map/bans";
import {
  bulkAddMembers,
  deleteMember as deleteMemberRpc,
  upsertMemberAsHost,
  type HostAuth,
} from "@/features/members/api";
import { BulkAddForm } from "@/features/members/BulkAddForm";
import { MemberForm } from "@/features/members/MemberForm";
import { MemberRow } from "@/features/members/MemberList";
import { TierIcon } from "@/features/members/TierIcon";
import { formatTier } from "@/features/members/tier";
import type { Member, MemberInput } from "@/features/members/types";
import { buildShareText } from "@/features/share/shareText";
import { SideCards, SideCardsCompact } from "@/features/side/SideCards";
import { formatSide } from "@/features/side/side";
import { formatScore, teamWarnings } from "@/features/teams/format";
import {
  rankTeamOptions,
  type TeamOption,
} from "@/features/teams/generateTeams";
import { teamReadiness } from "@/features/teams/readiness";
import { TeamCard, WarningBanner } from "@/features/teams/TeamCard";

import {
  rollMap as rollMapRpc,
  rollSide as rollSideRpc,
  setMapPool,
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

type TeamPick = {
  /** 이 결과를 만든 멤버 입력. 멤버가 바뀌면 다음 클릭에서 새로 계산 */
  key: string;
  options: TeamOption[];
  index: number;
};

const teamInputKey = (members: Member[]) =>
  JSON.stringify(
    members.map((m) => [m.id, m.currentTier, m.peakTier, m.positions]),
  );

type SheetState =
  | { kind: "add" }
  | { kind: "edit"; member: Member }
  | { kind: "bulk" }
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
function HostDashboard({ room, host }: { room: Room; host: HostAuth }) {
  const { code } = room;
  const queryClient = useQueryClient();
  const membersQuery = useMembers(room.id);
  const connected = useRoomRealtime(room);
  const members = membersQuery.data ?? [];

  // 팀 결과는 저장하지 않고 방장 화면 상태로만 (F5-4).
  // 상위 조합 목록을 들고 있다가 [팀 다시 짜기] 마다 다음 조합을 보여준다 (F5-5)
  const [teamPick, setTeamPick] = useState<TeamPick | null>(null);
  const teams = teamPick ? teamPick.options[teamPick.index] : null;

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

  const saveMember = (input: MemberInput, id?: string) =>
    run(async () => {
      await upsertMemberAsHost(host, input, id);
      closeSheet();
    });

  const deleteMember = (id: string) =>
    run(async () => {
      await deleteMemberRpc(host, id);
      closeSheet();
    });

  const bulkAdd = (names: string[]) =>
    run(async () => {
      const skipped = await bulkAddMembers(host, names);
      const added = names.length - skipped.length;
      closeSheet();
      show(
        skipped.length
          ? `${added}명 등록 · 중복 ${skipped.length}명 건너뜀`
          : `${added}명 등록했어요`,
      );
    });

  const makeTeams = () => {
    const key = teamInputKey(members);
    setTeamPick((prev) =>
      prev?.key === key
        ? { ...prev, index: (prev.index + 1) % prev.options.length }
        : { key, options: rankTeamOptions(members), index: 0 },
    );
  };

  /** 누를 때마다 서버에서 새로 뽑는다 (F6-3, F6-4) */
  const rollMap = () =>
    run(async () => {
      if (!remainingMaps(pool, bans).length) return;
      await rollMapRpc(host, bans);
      setSheet(null);
    });

  /** 누를 때마다 서버에서 새로 뽑는다 (F7-1, F7-3) */
  const rollSide = () =>
    run(async () => {
      await rollSideRpc(host);
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
      <div className="flex gap-1">
        <Button size="sm" onClick={() => setSheet({ kind: "bulk" })}>
          일괄 등록
        </Button>
        <Button size="sm" onClick={() => setSheet({ kind: "add" })}>
          + 추가
        </Button>
      </div>
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
          `${teamPick.index + 1}/${teamPick.options.length}번째 조합 · 점수 차 ${formatScore(teams.scoreDiff)} · 다시 누르면 다음 조합`
        ) : (
          "멤버 10명으로 5:5를 나눠요"
        )
      ) : (
        <span className="text-danger">{readiness.message}</span>
      )}
    </p>
  );

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
                  <TeamCard team={teams.teams[0]} index={0} />
                  <TeamCard team={teams.teams[1]} index={1} />
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
            <div className="grid grid-cols-2 gap-4">
              <TeamCard team={teams.teams[0]} index={0} />
              <TeamCard team={teams.teams[1]} index={1} />
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
      >
        <MemberForm
          submitLabel="추가"
          error={formError}
          onSubmit={(v) => saveMember(v)}
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
        open={sheet?.kind === "bulk"}
        title="일괄 등록"
        onClose={closeSheet}
      >
        <BulkAddForm onSubmit={bulkAdd} />
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
