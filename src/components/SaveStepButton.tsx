"use client";

import { useState } from "react";
import { updateStep } from "@/app/profile/setup-steps-actions";

export function SaveStepButton({ formId }: { formId: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleClick() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    setStatus("saving");
    await updateStep(new FormData(form));
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "saving"}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {status === "saving" ? "Saving…" : "Save"}
      </button>
      {status === "saved" && (
        <span className="text-xs font-semibold text-success">Saved</span>
      )}
    </div>
  );
}
