"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  renamePillar,
  renameSection,
  renameStep,
} from "@/app/profile/setup-steps-actions";

const iconButton =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md align-middle disabled:opacity-50";

// Shows the name with a pencil; the pencil swaps the name for a text box
// with save (check) and cancel (x), so renaming happens in place.
export function RenameButton({
  kind,
  path = "custom",
  phase = "",
  section,
  stepId,
  currentName,
  siblingNames = [],
}: {
  kind: "pillar" | "section" | "lesson";
  path?: "custom" | "express";
  phase?: string;
  section?: string;
  stepId?: string;
  currentName: string;
  siblingNames?: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [shownName, setShownName] = useOptimistic(currentName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentName);

  function save() {
    const next = draft.trim();
    if (!next || next === currentName) {
      setEditing(false);
      return;
    }
    if (
      siblingNames.includes(next) &&
      !window.confirm(
        `A ${kind} named "${next}" already exists here. Renaming will merge the two. Continue?`,
      )
    ) {
      return;
    }
    setEditing(false);
    startTransition(async () => {
      setShownName(next);
      if (kind === "pillar") {
        await renamePillar(path, phase, next);
      } else if (kind === "lesson") {
        await renameStep(stepId ?? "", next);
      } else {
        await renameSection(path, phase, section ?? "", next);
      }
    });
  }

  if (editing) {
    return (
      // This sits inside a <summary>: keep clicks and keys from opening or
      // closing it, or from starting a drag.
      <span
        className="inline-flex items-center gap-1 align-middle"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => {
          e.stopPropagation();
          if (e.key === " ") e.preventDefault();
        }}
      >
        <input
          autoFocus
          value={draft}
          aria-label={`New name for ${currentName}`}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          size={Math.max(draft.length, 8)}
          className="max-w-full rounded-md border border-accent bg-surface px-2 py-0.5 font-[inherit] text-[length:inherit] normal-case tracking-normal text-ink outline-none"
        />
        <button
          type="button"
          title="Save"
          aria-label="Save name"
          onClick={save}
          className={`${iconButton} text-success hover:bg-success-soft`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
        <button
          type="button"
          title="Cancel"
          aria-label="Cancel rename"
          onClick={() => setEditing(false)}
          className={`${iconButton} text-danger hover:bg-danger/10`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <>
      {shownName}
      <button
        type="button"
        disabled={isPending}
        title={`Rename this ${kind}`}
        aria-label={`Rename ${shownName}`}
        onClick={(e) => {
          // Inside a <summary>: don't let the click open or close it.
          e.preventDefault();
          e.stopPropagation();
          setDraft(currentName);
          setEditing(true);
        }}
        className={`ml-1.5 ${iconButton} text-ink-faint hover:bg-surface hover:text-ink`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </>
  );
}
