"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";

import type { Member } from "@/features/members/types";

import { MAX_PAIRS, pairedIds, type MemberPair } from "./pairs";

const nameOf = (members: readonly Member[], id: string) =>
  members.find((m) => m.id === id)?.nickname ?? "?";

/** "철수 · 영희" */
export function pairLabel(members: readonly Member[], [a, b]: MemberPair) {
  return `${nameOf(members, a)} · ${nameOf(members, b)}`;
}

/** 방장 화면 "같은 팀 묶기" (F5-8): 묶음 목록 + [+ 묶기] */
export function TeamPairsSection({
  pairs,
  members,
  onAdd,
  onRemove,
}: {
  pairs: readonly MemberPair[];
  members: readonly Member[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const free = members.length - pairedIds(pairs).size;
  const canAdd = pairs.length < MAX_PAIRS && free >= 2;
  return (
    <section aria-label="같은 팀 묶기" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">
          같은 팀 묶기{" "}
          <span className="text-muted font-normal">
            {pairs.length}/{MAX_PAIRS}
          </span>
        </h2>
        <Button size="sm" disabled={!canAdd} onClick={onAdd}>
          + 묶기
        </Button>
      </div>
      {pairs.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {pairs.map((p, i) => (
            <li
              key={p.join("+")}
              className="border-line-strong text-fg-2 flex h-8 items-center gap-1 rounded-full border pr-1 pl-3 text-[13px]"
            >
              {pairLabel(members, p)}
              <button
                type="button"
                aria-label={`${pairLabel(members, p)} 묶음 풀기`}
                onClick={() => onRemove(i)}
                className="text-faint hover:text-fg flex size-6 cursor-pointer items-center justify-center rounded-full"
              >
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-[13px]">
          꼭 같은 팀이어야 하는 두 명을 묶으면 팀을 짤 때 항상 같은 팀이 돼요
        </p>
      )}
    </section>
  );
}

/** 묶을 두 명 고르기 — 이미 묶인 멤버는 목록에서 뺀다 */
export function PairPicker({
  members,
  pairs,
  onSubmit,
}: {
  members: readonly Member[];
  pairs: readonly MemberPair[];
  onSubmit: (a: string, b: string) => void;
}) {
  const taken = pairedIds(pairs);
  const candidates = members.filter((m) => !taken.has(m.id));
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length < 2
          ? [...p, id]
          : [p[1], id],
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">
        두 명을 고르세요. 팀을 짤 때 항상 같은 팀이 되고, 선수 교체로도 갈라놓을
        수 없어요.
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {candidates.map((m) => {
          const on = picked.includes(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(m.id)}
                className={`h-11 w-full cursor-pointer truncate rounded-[10px] border px-3 text-left text-[15px] ${on ? "border-accent bg-accent-soft text-fg font-semibold" : "border-line text-fg-2"}`}
              >
                {m.nickname}
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={picked.length !== 2}
        onClick={() => onSubmit(picked[0], picked[1])}
      >
        묶기
      </Button>
    </div>
  );
}
