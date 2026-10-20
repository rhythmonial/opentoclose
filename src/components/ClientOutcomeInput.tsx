"use client";

import { useTransition } from "react";
import { updateClientOutcome } from "@/app/dashboard/actions";

export function ClientOutcomeInput({
  accountId,
  outcome,
}: {
  accountId: string;
  outcome: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      defaultValue={outcome ?? ""}
      disabled={isPending}
      placeholder="Why they churned, or how setup wrapped up"
      onBlur={(e) => {
        if (e.target.value.trim() === (outcome ?? "")) return;
        const formData = new FormData();
        formData.set("account_id", accountId);
        formData.set("outcome", e.target.value);
        startTransition(() => {
          updateClientOutcome(formData);
        });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-full min-w-[220px] rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
    />
  );
}
