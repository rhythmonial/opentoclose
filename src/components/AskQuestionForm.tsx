"use client";

import { useFormStatus } from "react-dom";
import { createTicket } from "@/app/support/actions";
import { AttachmentInput } from "@/components/AttachmentInput";

export type LessonChoice = { id: string; title: string; phase: string };

const input =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send question"}
    </button>
  );
}

// A new support question: the lesson it's about (picked for them when
// asked from a lesson), a subject, the question, and images or videos.
export function AskQuestionForm({
  lessons,
  defaultStepId,
  returnTo,
}: {
  lessons: LessonChoice[];
  defaultStepId?: string | null;
  // Where to come back to once it's sent (the support page or a lesson).
  returnTo: string;
}) {
  const phases = Array.from(new Set(lessons.map((l) => l.phase)));

  return (
    <form action={createTicket} className="flex flex-col gap-3">
      <input type="hidden" name="return_to" value={returnTo} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Lesson you need help with</span>
        <select
          name="step_id"
          required
          defaultValue={defaultStepId ?? ""}
          className={input}
        >
          <option value="" disabled>
            Choose a lesson
          </option>
          <option value="general">General question (not about one lesson)</option>
          {phases.map((phase) => (
            <optgroup key={phase} label={phase}>
              {lessons
                .filter((l) => l.phase === phase)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Subject</span>
        <input name="subject" required maxLength={200} className={input} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Your question</span>
        <textarea name="message" rows={4} required className={input} />
      </label>
      <AttachmentInput />
      <div className="flex justify-end">
        <SendButton />
      </div>
    </form>
  );
}
