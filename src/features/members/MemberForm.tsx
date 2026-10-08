"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import {
  DEFAULT_POSITIONS,
  NEXT_PROFICIENCY,
  NICKNAME_MAX_LENGTH,
  POSITION_LABELS,
  POSITIONS,
  PROFICIENCY_LABELS,
  TIER_GROUPS,
  UNRANKED,
  type PositionProficiency,
  type Tier,
} from "@/lib/constants";

import { POSITION_ICONS } from "./positions";
import { isFreePositions } from "./positionSummary";
import { TierIcon } from "./TierIcon";
import {
  formatTier,
  groupShortLabel,
  makeTier,
  tierDivisionOf,
  tierGroupOf,
  type TierGroupOrUnranked,
} from "./tier";
import type { Member, MemberInput } from "./types";

type MemberFormProps = {
  initial?: Member;
  submitLabel?: string;
  /** 저장 실패 메시지 (닉네임 중복 등) */
  error?: string | null;
  onSubmit: (input: MemberInput) => void;
  /** [저장하고 하나 더] — 있으면 버튼 표시 (방장 연속 추가) */
  onSubmitAndNext?: (input: MemberInput) => void;
  /** 열리자마자 닉네임 입력에 포커스 */
  autoFocus?: boolean;
};

type TierSlot = "current" | "peak";

const GROUP_KEYS: TierGroupOrUnranked[] = [
  ...TIER_GROUPS.map((g) => g.key),
  UNRANKED,
];

/** 멤버 등록·수정 폼 — 시안 MemberForm / PcParticipant 왼쪽 패널 (F3) */
export function MemberForm({
  initial,
  submitLabel = "저장",
  error,
  onSubmit,
  onSubmitAndNext,
  autoFocus,
}: MemberFormProps) {
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [tiers, setTiers] = useState<Record<TierSlot, Tier | null>>({
    current: initial?.currentTier ?? null,
    peak: initial?.peakTier ?? null,
  });
  const [slot, setSlot] = useState<TierSlot>("current");
  const [positions, setPositions] = useState<PositionProficiency>(
    initial?.positions ?? DEFAULT_POSITIONS,
  );

  const selected = tiers[slot];
  const selectedGroup = selected ? tierGroupOf(selected) : null;
  const hasDivisions =
    selectedGroup !== null &&
    TIER_GROUPS.find((g) => g.key === selectedGroup)?.divisions === 3;

  const trimmed = nickname.trim();
  const needsPeak = tiers.current === UNRANKED && !tiers.peak;
  const validationError = !trimmed
    ? "닉네임을 입력해주세요"
    : !tiers.current
      ? "현티를 선택해주세요"
      : needsPeak
        ? "언랭이면 최티를 선택해주세요"
        : null;

  const pickGroup = (group: TierGroupOrUnranked) => {
    const division = (selected && tierDivisionOf(selected)) ?? 1;
    setTiers((t) => ({ ...t, [slot]: makeTier(group, division) }));
  };
  const pickDivision = (division: number) => {
    if (!selectedGroup) return;
    setTiers((t) => ({ ...t, [slot]: makeTier(selectedGroup, division) }));
  };

  const currentInput = (): MemberInput => ({
    nickname: trimmed,
    currentTier: tiers.current,
    peakTier: tiers.peak,
    positions,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validationError) return;
    onSubmit(currentInput());
  };

  const slotLabel = (s: TierSlot) => {
    const t = tiers[s];
    const name = s === "current" ? "현티" : "최티";
    return t ? `${name} · ${formatTier(t)}` : name;
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-[22px]">
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="text-muted text-[13px]">
          닉네임
        </label>
        <input
          id="nickname"
          autoFocus={autoFocus}
          value={nickname}
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(e) => setNickname(e.target.value)}
          placeholder="디코 닉네임"
          className="border-line bg-surface text-fg focus:border-line-strong lg:bg-bg h-[52px] rounded-xl border px-4 text-base outline-none lg:h-12 lg:rounded-[10px]"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <div
          role="tablist"
          aria-label="티어 종류"
          className="bg-surface lg:bg-bg flex gap-1 rounded-xl p-1"
        >
          {(["current", "peak"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={slot === s}
              onClick={() => setSlot(s)}
              className={`h-10 flex-1 cursor-pointer rounded-[9px] text-sm ${slot === s ? "bg-surface-strong text-fg font-semibold" : "text-muted font-medium"}`}
            >
              {slotLabel(s)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {GROUP_KEYS.filter((g) => slot === "current" || g !== UNRANKED).map(
            (group) => {
              const on = selectedGroup === group;
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickGroup(group)}
                  className={`flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border text-xs ${on ? "border-fg bg-surface-active text-fg font-semibold" : "border-line text-muted"}`}
                >
                  {/* 선택된 그룹이면 고른 단계, 아니면 1단계 아이콘 */}
                  <TierIcon
                    tier={on ? selected : makeTier(group, 1)}
                    size={32}
                  />
                  <span>{groupShortLabel(group)}</span>
                </button>
              );
            },
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((d) => {
            const on = hasDivisions && tierDivisionOf(selected!) === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                disabled={!hasDivisions}
                onClick={() => pickDivision(d)}
                className={`h-11 cursor-pointer rounded-[10px] border font-mono text-[15px] disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-fg bg-fg text-bg font-semibold" : "border-line text-fg-2"}`}
              >
                {d}
              </button>
            );
          })}
        </div>

        {slot === "peak" && (
          <p className="text-faint text-xs">
            비워두면 현티와 같게 계산해요.
            {tiers.peak && (
              <button
                type="button"
                onClick={() => setTiers((t) => ({ ...t, peak: null }))}
                className="text-muted ml-2 cursor-pointer underline underline-offset-2"
              >
                최티 비우기
              </button>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-muted text-[13px]">
            포지션 <span className="text-faint">(선택)</span>
          </span>
          {isFreePositions(positions) ? (
            <span className="text-faint text-xs">
              선택 안 하면 비워둬요 · 탭: 가능 → 주력 → 불가
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPositions(DEFAULT_POSITIONS)}
              className="text-muted cursor-pointer text-xs underline underline-offset-2"
            >
              선택 해제
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {POSITIONS.map((pos) => {
            const level = positions[pos];
            const Icon = POSITION_ICONS[pos];
            const style =
              level === "main"
                ? "border-solid border-accent bg-accent-soft text-fg"
                : level === "can"
                  ? "border-solid border-line-strong text-fg"
                  : "border-dashed border-line text-faint";
            return (
              <button
                key={pos}
                type="button"
                aria-label={`${POSITION_LABELS[pos]}: ${PROFICIENCY_LABELS[level]}`}
                onClick={() =>
                  setPositions((p) => ({
                    ...p,
                    [pos]: NEXT_PROFICIENCY[p[pos]],
                  }))
                }
                className={`flex h-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border ${style}`}
              >
                <Icon size={20} />
                <span
                  className={`text-[13px] font-semibold ${level === "no" ? "line-through" : ""}`}
                >
                  {POSITION_LABELS[pos]}
                </span>
                <span
                  className={`text-[11px] ${level === "main" ? "text-accent font-semibold" : level === "can" ? "text-muted" : ""}`}
                >
                  {PROFICIENCY_LABELS[level]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {(error || (validationError && trimmed)) && (
          <p className="text-danger text-center text-[13px]">
            {error ?? validationError}
          </p>
        )}
        <div className={onSubmitAndNext ? "grid grid-cols-2 gap-2" : ""}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!!validationError}
            className="w-full"
          >
            {submitLabel}
          </Button>
          {onSubmitAndNext && (
            <Button
              size="lg"
              disabled={!!validationError}
              className="w-full text-base"
              onClick={() =>
                !validationError && onSubmitAndNext(currentInput())
              }
            >
              저장하고 하나 더
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
