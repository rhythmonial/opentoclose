"use client";

import { useContext, useState } from "react";
import { updateStep } from "@/app/profile/setup-steps-actions";
import { LESSON_SAVED_EVENT, LessonDirtyContext } from "@/components/LessonPanel";

// A lesson's save icon in its header: faded while everything's saved, red
// once something's changed.
export function SaveStepButton({ formId }: { formId: string }) {
  const dirty = useContext(LessonDirtyContext);
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    // Points at anything required that's missing, like a video's thumbnail.
    if (!form.reportValidity()) return;
    setSaving(true);
    await updateStep(new FormData(form));
    // Lets the lesson panel know its fields are saved now.
    form.dispatchEvent(new Event(LESSON_SAVED_EVENT));
    setSaving(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving || !dirty}
      title={dirty ? "Save changes" : "Saved"}
      aria-label={dirty ? "Save changes" : "Saved"}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg border ${
        dirty ? "border-danger bg-danger text-white" : "border-border text-ink-faint opacity-50"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
      </svg>
    </button>
  );
}
