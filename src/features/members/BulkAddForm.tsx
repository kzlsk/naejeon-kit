"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

import { parseNicknames } from "./bulk";

export function BulkAddForm({
  onSubmit,
}: {
  onSubmit: (nicknames: string[]) => void;
}) {
  const [text, setText] = useState("");
  const names = parseNicknames(text);

  return (
    <form
      className="flex flex-1 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (names.length) onSubmit(names);
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="bulk" className="text-muted text-[13px]">
          닉네임을 한 줄에 하나씩 붙여넣어 주세요
        </label>
        <textarea
          id="bulk"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={"철수\n영희\n민수"}
          className="border-line bg-surface text-fg focus:border-line-strong min-h-56 resize-y rounded-xl border p-4 text-base leading-relaxed outline-none"
        />
        <p className="text-faint text-xs">
          티어는 등록 후 한 명씩 입력해요. 이미 있는 닉네임은 건너뛰어요.
        </p>
      </div>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!names.length}
        className="mt-auto w-full"
      >
        {names.length ? `${names.length}명 등록` : "등록"}
      </Button>
    </form>
  );
}
