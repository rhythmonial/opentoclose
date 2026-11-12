"use client";

import { createContext, useEffect, useRef, useState } from "react";
import { updateStep } from "@/app/profile/setup-steps-actions";

// Fired on a lesson's form by SaveStepButton (and by this panel) once its
// fields are saved, so the panel knows they're no longer unsaved.
export const LESSON_SAVED_EVENT = "lesson-saved";

// Whether the lesson has unsaved changes (for its Save button).
export const LessonDirtyContext = createContext(false);

// Serializes a lesson's form fields, to tell when they differ from what's
// saved (typing, toolbar formatting, changing the lesson type, ...).
function snapshot(formId: string) {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return "";
  return JSON.stringify([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
}

// A lesson in the Setup Tasks editor. While its fields have unsaved changes
// it says so in its header, won't collapse until they're saved, and has the
// browser warn before leaving the page.
export function LessonPanel({
  formId,
  summary,
  children,
}: {
  formId: string;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const saved = useRef("");
  const [dirty, setDirty] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const panel = ref.current;
    const form = document.getElementById(formId);
    if (!panel || !form) return;
    saved.current = snapshot(formId);

    // Some edits (toolbar formatting) set values after the event, so check
    // once they've landed.
    const check = () =>
      window.setTimeout(() => {
        const isDirty = snapshot(formId) !== saved.current;
        setDirty(isDirty);
        if (!isDirty) setBlocked(false);
      }, 0);
    const onSaved = () => {
      saved.current = snapshot(formId);
      setDirty(false);
      setBlocked(false);
    };

    panel.addEventListener("input", check);
    panel.addEventListener("change", check);
    panel.addEventListener("click", check);
    form.addEventListener(LESSON_SAVED_EVENT, onSaved);
    return () => {
      panel.removeEventListener("input", check);
      panel.removeEventListener("change", check);
      panel.removeEventListener("click", check);
      form.removeEventListener(LESSON_SAVED_EVENT, onSaved);
    };
  }, [formId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function saveAndClose() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form || !form.reportValidity()) return;
    setSaving(true);
    await updateStep(new FormData(form));
    form.dispatchEvent(new Event(LESSON_SAVED_EVENT));
    setSaving(false);
    if (ref.current) ref.current.open = false;
  }

  return (
    <LessonDirtyContext.Provider value={dirty}>
    <details
      ref={ref}
      className="rounded-lg border border-border bg-surface px-4 py-2 open:pb-4"
    >
      <summary
        onClick={(e) => {
          // Buttons, links and checkboxes in the header do their own thing.
          const target = e.target as HTMLElement;
          if (target.closest("button, a, input, select, label, textarea")) return;
          if (ref.current?.open && dirty) {
            e.preventDefault();
            setBlocked(true);
          }
        }}
        className="flex cursor-pointer flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        {summary}
        {dirty && (
          <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 font-caption text-[10px] font-bold uppercase tracking-wide text-warning">
            Unsaved changes
          </span>
        )}
      </summary>

      {blocked && dirty && (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-2.5"
        >
          <span className="text-sm font-medium text-warning">
            This lesson has unsaved changes. Save them before closing it.
          </span>
          <button
            type="button"
            onClick={saveAndClose}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save and close"}
          </button>
        </div>
      )}

      {children}
    </details>
    </LessonDirtyContext.Provider>
  );
}
