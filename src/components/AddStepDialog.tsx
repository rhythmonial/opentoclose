"use client";

import { useActionState, useState } from "react";
import { createPortal } from "react-dom";
import { addStepAt, type AddStepResult } from "@/app/profile/setup-steps-actions";
import { LessonTypeFields } from "@/components/LessonTypeFields";
import { MarkdownTextarea } from "@/components/MarkdownTextarea";

const inputClass =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

type Mode = "lesson" | "section" | "pillar";

const HEADINGS: Record<Mode, (where: string) => string> = {
  lesson: (where) => `Add a lesson to ${where}`,
  section: (where) => `Add a section to ${where}`,
  pillar: () => "Add a pillar",
};

// A + button that opens a pop-up for adding a lesson to a section, a new
// section to a pillar, or a new pillar. The pop-up is portaled to <body> so
// clicks in it don't open or close the <summary> the button sits in.
export function AddStepDialog({
  mode,
  path = "custom",
  phase = "",
  section = "",
  where = "",
  trigger,
}: {
  mode: Mode;
  path?: "custom" | "express";
  phase?: string;
  section?: string;
  where?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [result, submit, isPending] = useActionState(
    async (_prev: AddStepResult | null, formData: FormData) => {
      const next = await addStepAt(formData);
      if (next.ok) setOpen(false);
      return next;
    },
    null,
  );

  return (
    <>
      <button
        type="button"
        title={HEADINGS[mode](where)}
        aria-label={HEADINGS[mode](where)}
        onClick={(e) => {
          // Inside a <summary>: don't let the click open or close it.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          trigger
            ? "text-sm font-semibold text-accent"
            : "ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md align-middle text-ink-faint hover:bg-surface hover:text-accent"
        }
      >
        {trigger ?? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>

      {open &&
        createPortal(
          <dialog
            ref={(el) => {
              if (el && !el.open) el.showModal();
            }}
            onClose={() => setOpen(false)}
            onClick={(e) => {
              // A click on the backdrop lands on the dialog itself.
              if (e.target === e.currentTarget) setOpen(false);
            }}
            className="m-auto w-[min(100%-2rem,36rem)] rounded-xl border border-border bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
          >
            <form action={submit} className="flex flex-col gap-3 p-5">
              <h2 className="font-display text-lg font-bold text-ink">
                {HEADINGS[mode](where)}
              </h2>
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="path" value={path} />
              {mode !== "pillar" && (
                <input type="hidden" name="phase" value={phase} />
              )}
              {mode === "lesson" && (
                <input type="hidden" name="section" value={section} />
              )}

              {mode === "pillar" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Pillar name</span>
                  <input name="phase" required autoFocus className={inputClass} />
                </label>
              )}
              {mode !== "lesson" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Section name</span>
                  <input
                    name="section"
                    required
                    autoFocus={mode === "section"}
                    className={inputClass}
                  />
                </label>
              )}
              {mode !== "lesson" && (
                <p className="mt-1 font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  First lesson
                </p>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">Lesson title</span>
                <input
                  name="title"
                  required
                  autoFocus={mode === "lesson"}
                  className={inputClass}
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LessonTypeFields defaultType="lesson" />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">Description</span>
                <MarkdownTextarea name="description" rows={3} />
              </label>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Completed by</span>
                  <select name="completed_by" defaultValue="diy" className={inputClass}>
                    <option value="diy">DIY</option>
                    <option value="setup">Setup</option>
                    <option value="both">Both</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 pb-2.5 text-xs font-medium text-ink-soft">
                  <input type="checkbox" name="is_optional" className="h-4 w-4" />
                  Optional
                </label>
                <label className="flex items-center gap-2 pb-2.5 text-xs font-medium text-ink-soft">
                  <input type="checkbox" name="is_future_build" className="h-4 w-4" />
                  Future Build
                </label>
              </div>

              <p className="text-xs text-ink-faint">
                New lessons start switched Off, so clients won&rsquo;t see it
                until you turn it On.
              </p>
              {result && !result.ok && (
                <p role="alert" className="text-sm font-medium text-danger">
                  {result.error}
                </p>
              )}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isPending ? "Adding…" : mode === "lesson" ? "Add lesson" : `Add ${mode}`}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}
