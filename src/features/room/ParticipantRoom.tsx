"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ShieldIcon, SwordIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Toast, useToast } from "@/components/ui/Toast";
import { MAPS } from "@/lib/constants";
import { isRpcError } from "@/lib/supabase/rpc";

import { MapResultHero } from "@/features/map/MapResult";
import { deleteSelf, registerSelf, updateSelf } from "@/features/members/api";
import { clearMe, setMe, type Me } from "@/features/members/meStorage";
import { MemberForm } from "@/features/members/MemberForm";
import { MemberDetailPanel } from "@/features/members/MemberDetailPanel";
import { MemberCard, MemberRow } from "@/features/members/MemberList";
import {
  memberPanelMode,
  memberPanelTitle,
} from "@/features/members/memberPanel";
import type { Member, MemberInput } from "@/features/members/types";
import { useMe } from "@/features/members/useMe";
import {
  useIsDesktop,
  useMemberSelection,
} from "@/features/members/useMemberSelection";
import {
  formatSide,
  otherSide,
  SIDE_LABELS,
  type Side,
} from "@/features/side/side";
import { TEAM_NAMES } from "@/features/teams/format";
import { resolveTeams } from "@/features/teams/published";
import { teamIndexOf } from "@/features/teams/swap";
import { TEAM_COLOR, TeamCard } from "@/features/teams/TeamCard";

import type { Room } from "./api";
import { queryKeys, useMembers, useRoom, useRoomRealtime } from "./queries";
import { RoomHeader } from "./RoomHeader";
import { RoomError, RoomExpired, RoomLoading } from "./RoomStatus";

const NICKNAME_TAKEN_MESSAGE =
  "이미 있는 닉네임이에요. 방장이 등록해뒀다면 방장에게 수정을 부탁하세요";
const LOST_ME_MESSAGE = "내 정보를 찾을 수 없어요. 다시 입력해주세요";
const GENERIC_ERROR = "저장하지 못했어요. 잠시 후 다시 시도해주세요";

/** 참가자 화면 — 시안 Participant / PcParticipant (F3-6~F3-9) */
export function ParticipantRoom({ code }: { code: string }) {
  const roomQuery = useRoom(code);
  if (roomQuery.isPending) return <RoomLoading />;
  if (roomQuery.isError) {
    return <RoomError onRetry={() => roomQuery.refetch()} />;
  }
  if (!roomQuery.data) return <RoomExpired />;
  return <ParticipantView room={roomQuery.data} />;
}

function ParticipantView({ room }: { room: Room }) {
  const { code } = room;
  const queryClient = useQueryClient();
  const membersQuery = useMembers(room.id);
  const connected = useRoomRealtime(room);
  const me = useMe(code);
  const [toast, showToast] = useToast(2400);

  const members = membersQuery.data;
  const myMember = me ? members?.find((m) => m.id === me.id) : undefined;

  // 저장된 id 가 목록에 없으면(방장이 삭제) 입력 화면으로.
  // 화면 분기는 표시용일 뿐이고 실제 권한 검사는 RPC 에서 한다.
  const settled = membersQuery.isSuccess && !membersQuery.isFetching;
  useEffect(() => {
    if (me && settled && !myMember) {
      clearMe(code);
      showToast(LOST_ME_MESSAGE);
    }
  }, [me, settled, myMember, code, showToast]);

  const refreshMembers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.members(room.id) });

  /** FORBIDDEN: 토큰이 더 이상 유효하지 않음 → 입력 화면으로 */
  const handleLostMe = () => {
    clearMe(code);
    showToast(LOST_ME_MESSAGE);
    refreshMembers();
  };

  if (me === undefined || membersQuery.isPending) return <RoomLoading />;
  if (membersQuery.isError) {
    return <RoomError onRetry={() => membersQuery.refetch()} />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-5 pt-4 lg:p-0">
        <RoomHeader
          code={code}
          userType="participant"
          connected={connected}
          actions={<span className="text-muted text-[13px]">참가자</span>}
        />
      </div>

      {me && myMember ? (
        <RegisteredView
          room={room}
          members={membersQuery.data}
          me={me}
          myMember={myMember}
          onLostMe={handleLostMe}
          onError={showToast}
          onChanged={refreshMembers}
        />
      ) : (
        <RegisterView
          code={code}
          onRegistered={(newMe, input) => {
            // 목록에 내 줄을 먼저 넣고 setMe → "목록에 없음" 판정에 걸리지 않게
            queryClient.setQueryData<Member[]>(
              queryKeys.members(room.id),
              (list = []) => [...list, { id: newMe.id, ...input }],
            );
            setMe(code, newMe);
            refreshMembers();
          }}
          onRoomGone={() =>
            queryClient.invalidateQueries({ queryKey: queryKeys.room(code) })
          }
          onError={showToast}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}

/* ───────────────────────── 미등록: 정보 입력 (F3-6) ───────────────────────── */

function RegisterView({
  code,
  onRegistered,
  onRoomGone,
  onError,
}: {
  code: string;
  onRegistered: (me: Me, input: MemberInput) => void;
  onRoomGone: () => void;
  onError: (msg: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (input: MemberInput) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      onRegistered(await registerSelf(code, input), input);
    } catch (e) {
      if (isRpcError(e, "NICKNAME_TAKEN")) setFormError(NICKNAME_TAKEN_MESSAGE);
      else if (isRpcError(e, "ROOM_NOT_FOUND")) onRoomGone();
      else onError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="lg:bg-surface mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-6 px-5 pt-6 pb-6 lg:my-8 lg:flex-none lg:rounded-2xl lg:p-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-bold tracking-tight">내 정보 입력</h1>
        <p className="text-muted text-[15px] leading-relaxed">
          닉네임과 티어, 포지션을 알려주세요. 나중에 수정할 수 있어요.
        </p>
      </div>
      <MemberForm
        submitLabel={busy ? "저장 중…" : "참가하기"}
        error={formError}
        onSubmit={submit}
        riotRoomCode={code}
      />
    </main>
  );
}

/* ───────────────────────── 등록됨: 내 정보 + 목록 ───────────────────────── */

type RegisteredViewProps = {
  room: Room;
  members: Member[];
  me: Me;
  myMember: Member;
  onLostMe: () => void;
  onError: (msg: string) => void;
  onChanged: () => void;
};

/** 테스트에서 직접 렌더 (쿼리 없이 props 만 받음) */
export function RegisteredView({
  room,
  members,
  me,
  myMember,
  onLostMe,
  onError,
  onChanged,
}: RegisteredViewProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeEdit = () => {
    setEditing(false);
    setFormError(null);
  };

  const save = async (input: MemberInput) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await updateSelf(me, input);
      closeEdit();
      onChanged();
    } catch (e) {
      if (isRpcError(e, "NICKNAME_TAKEN")) setFormError(NICKNAME_TAKEN_MESSAGE);
      else if (isRpcError(e, "FORBIDDEN")) onLostMe();
      else onError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteSelf(me);
      clearMe(room.code);
      onChanged();
    } catch (e) {
      if (isRpcError(e, "FORBIDDEN")) onLostMe();
      else onError("삭제하지 못했어요. 잠시 후 다시 시도해주세요");
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const map = room.resultMap;
  const side = room.sideTeam1;

  // 기본 선택은 본인. 다른 멤버를 고르면 ?member=<id>
  const selection = useMemberSelection(members, me.id);
  const isDesktop = useIsDesktop();
  const selected = members.find((m) => m.id === selection.selectedId) ?? null;

  const panelFor = (
    member: Member | null,
    options: { hideTitle?: boolean; closable?: boolean } = {},
  ) => {
    const mode = memberPanelMode({
      userType: "participant",
      selectedId: member?.id ?? null,
      meId: me.id,
    });
    return (
      <MemberDetailPanel
        member={member}
        title={memberPanelTitle(mode, member?.nickname)}
        hideTitle={options.hideTitle}
        actions={
          mode.kind === "me" && (
            <>
              <Button
                size="sm"
                className="px-3.5"
                onClick={() => setEditing(true)}
              >
                수정
              </Button>
              <Button
                size="sm"
                className="text-danger px-3.5"
                onClick={() => setConfirmingDelete(true)}
              >
                삭제
              </Button>
            </>
          )
        }
        onBackToMe={
          mode.kind === "other" ? () => selection.select(me.id) : undefined
        }
        onClose={
          options.closable && mode.kind === "other"
            ? selection.clear
            : undefined
        }
      />
    );
  };

  const sheetMember =
    members.find((m) => m.id === selection.requestedId) ?? null;

  // 방장이 공유한 팀 (F5-7). 멤버가 삭제되는 등 맞지 않으면 방장이 다시 짤 때까지 숨긴다
  const teams = room.teamIds ? resolveTeams(room.teamIds, members) : null;
  const myTeam = teams ? teamIndexOf(teams, me.id) : -1;
  const teamSide = (i: 0 | 1) => side && (i === 0 ? side : otherSide(side));

  const myTeamBanner = teams && (
    <MyTeamBanner
      index={myTeam === 0 || myTeam === 1 ? myTeam : null}
      side={myTeam === 0 || myTeam === 1 ? teamSide(myTeam) : null}
    />
  );
  const teamCards = teams && (
    <>
      {([0, 1] as const).map((i) => (
        <TeamCard
          key={i}
          team={teams.teams[i]}
          index={i}
          side={teamSide(i)}
          meId={me.id}
        />
      ))}
    </>
  );

  return (
    <>
      {/* ───────── 모바일 ───────── */}
      <div className="flex flex-col gap-5 px-5 pt-5 pb-6 lg:hidden">
        <div className="flex gap-2">
          <SummaryTile label="맵" value={map ? MAPS[map] : "—"} />
          <SummaryTile
            label="공수"
            value={side ? `팀1 ${SIDE_LABELS[side]} 시작` : "—"}
          />
        </div>
        {myTeamBanner}
        <div className="border-line-strong rounded-[14px] border p-4">
          {panelFor(myMember)}
        </div>
        {teams && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold">팀</h2>
            {teamCards}
          </section>
        )}
        <section className="flex flex-col">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-[15px] font-semibold">멤버</h2>
            <span className="text-muted text-[13px]">{members.length}명</span>
          </div>
          <ul>
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isMe={m.id === me.id}
                selected={m.id === selection.requestedId}
                onSelect={selection.select}
              />
            ))}
          </ul>
        </section>
      </div>

      {/* ───────── PC ───────── */}
      <div className="mx-auto hidden w-full max-w-[1360px] items-start gap-6 px-8 pt-6 pb-10 lg:flex">
        <aside className="flex w-[400px] shrink-0 flex-col gap-4">
          {myTeamBanner}
          <div className="bg-surface rounded-2xl p-6">
            {panelFor(selected, { closable: true })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex gap-4">
            {map ? (
              <MapResultHero
                map={map}
                label="맵"
                className="h-[120px] flex-[1_1_280px] rounded-2xl"
              />
            ) : (
              <PcSummary label="맵" value="아직 안 정했어요" />
            )}
            <PcSummary
              label="공수"
              value={side ? formatSide(side) : "아직 안 정했어요"}
            />
          </div>

          {teams && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold">팀</h2>
              <div className="grid grid-cols-2 gap-4">{teamCards}</div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[15px] font-semibold">멤버</h2>
              <span className="text-muted text-[13px]">{members.length}명</span>
            </div>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2">
              {members.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  isMe={m.id === me.id}
                  selected={m.id === selection.selectedId}
                  onSelect={selection.select}
                />
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* 모바일: 행을 누르면 하단 시트 */}
      <BottomSheet
        open={!isDesktop && !!sheetMember && !editing && !confirmingDelete}
        title={
          sheetMember?.id === me.id ? "내 정보" : (sheetMember?.nickname ?? "")
        }
        onClose={selection.clear}
      >
        {panelFor(sheetMember, { hideTitle: true })}
      </BottomSheet>

      <Sheet open={editing} title="내 정보 수정" onClose={closeEdit}>
        <MemberForm
          key={String(editing)}
          initial={myMember}
          submitLabel={busy ? "저장 중…" : "저장"}
          error={formError}
          onSubmit={save}
          riotRoomCode={room.code}
        />
      </Sheet>

      <ConfirmDialog
        open={confirmingDelete}
        title="내 정보를 삭제할까요?"
        description="다시 참가하려면 새로 입력해야 해요"
        confirmLabel={busy ? "삭제 중…" : "삭제"}
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}

/** 내 팀 · 시작 진영 (F5-7). index null = 공유된 팀에 내가 없음 */
function MyTeamBanner({
  index,
  side,
}: {
  index: 0 | 1 | null;
  side: Side | null;
}) {
  if (index === null) {
    return (
      <section className="bg-surface flex flex-col gap-1 rounded-[14px] px-4 py-3.5 lg:rounded-2xl lg:px-6 lg:py-5">
        <span className="text-muted text-xs">내 팀</span>
        <span className="text-base font-semibold">이번 팀에는 없어요</span>
      </section>
    );
  }
  const SideIcon = side === "attack" ? SwordIcon : ShieldIcon;
  return (
    <section
      aria-label="내 팀"
      className="bg-surface flex items-center gap-3 rounded-[14px] px-4 py-3.5 lg:rounded-2xl lg:px-6 lg:py-5"
    >
      <span className={`size-3 rounded-[3px] ${TEAM_COLOR[index]}`} />
      <div className="flex flex-col">
        <span className="text-muted text-xs">내 팀</span>
        <span className="text-xl font-bold">{TEAM_NAMES[index]}</span>
      </div>
      {side ? (
        <span className="ml-auto flex items-center gap-1.5 text-lg font-bold">
          <SideIcon size={20} className="text-accent" />
          {SIDE_LABELS[side]} 시작
        </span>
      ) : (
        <span className="text-muted ml-auto text-sm">공수 미정</span>
      )}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface flex flex-1 flex-col gap-1 rounded-xl px-3.5 py-3">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}

function PcSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface flex h-[120px] flex-[1_1_220px] flex-col justify-end gap-0.5 rounded-2xl p-5">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-[22px] font-bold">{value}</span>
    </div>
  );
}
