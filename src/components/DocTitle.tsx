"use client";

import { useState } from "react";
import { renameContractDocument } from "@/app/configurator/upload_your_contract_docs/actions";

// An uploaded document's name, renamed in place: with a pencil beside it,
// or (on its own page) by clicking the name. Enter or clicking away saves;
// Escape cancels.
export function DocTitle({
  id,
  name: initial,
  className,
  clickToRename = false,
}: {
  id: string;
  name: string;
  className: string;
  clickToRename?: boolean;
}) {
  const [name, setName] = useState(initial);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (!next || next === name) return;
    const before = name;
    setName(next);
    const res = await renameContractDocument(id, next);
    if (res.ok && res.name) {
      setName(res.name);
      setError(null);
    } else {
      setName(before);
      setError(res.error ?? "Couldn’t rename it.");
    }
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={200}
        aria-label="Document name"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(null);
        }}
        className={`${className} pointer-events-auto relative w-full min-w-0 rounded-md border border-accent bg-surface px-1.5 outline-none`}
      />
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {clickToRename ? (
        <button
          type="button"
          onClick={() => setDraft(name)}
          title="Click to rename"
          className={`${className} min-w-0 truncate rounded-md text-left hover:bg-accent-soft/50`}
        >
          {name}
        </button>
      ) : (
        <>
          <span className={`${className} min-w-0 truncate`}>{name}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraft(name);
            }}
            aria-label={`Rename ${name}`}
            title="Rename"
            className="pointer-events-auto relative shrink-0 rounded p-0.5 text-ink-faint hover:bg-accent-soft/60 hover:text-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </>
      )}
      {error && <span className="shrink-0 text-xs font-normal text-danger">{error}</span>}
    </span>
  );
}
