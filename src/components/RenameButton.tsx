"use client";

import { useTransition } from "react";
import {
  renamePillar,
  renameSection,
  renameStep,
} from "@/app/profile/setup-steps-actions";

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

  return (
    <button
      type="button"
      disabled={isPending}
      title={`Rename this ${kind}`}
      aria-label={`Rename ${currentName}`}
      onClick={(e) => {
        // Inside a <summary>: don't let the click open or close it.
        e.preventDefault();
        e.stopPropagation();
        const next = window.prompt(`Rename the "${currentName}" ${kind}:`, currentName)?.trim();
        if (!next || next === currentName) return;
        if (
          siblingNames.includes(next) &&
          !window.confirm(
            `A ${kind} named "${next}" already exists here. Renaming will merge the two. Continue?`,
          )
        ) {
          return;
        }
        startTransition(async () => {
          if (kind === "pillar") {
            await renamePillar(path, phase, next);
          } else if (kind === "lesson") {
            await renameStep(stepId ?? "", next);
          } else {
            await renameSection(path, phase, section ?? "", next);
          }
        });
      }}
      className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md align-middle text-ink-faint hover:bg-surface hover:text-ink disabled:opacity-50"
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
  );
}
