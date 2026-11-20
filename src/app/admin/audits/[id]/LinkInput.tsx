"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/CopyButton";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// A link field with a copy icon to its right (copies what's typed).
export function LinkInput({ name, initial }: { name: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <span className="flex items-center gap-1.5">
      <input
        name={name}
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://…"
        className={INPUT}
      />
      {value.trim() ? <CopyIcon text={value.trim()} /> : <span className="w-5 shrink-0" aria-hidden />}
    </span>
  );
}
