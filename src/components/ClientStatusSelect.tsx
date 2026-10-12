"use client";

import { useTransition } from "react";
import { updateClientStatus } from "@/app/dashboard/actions";

const STATUSES = ["active", "paused", "completed", "churned"];

export function ClientStatusSelect({
  accountId,
  status,
}: {
  accountId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("account_id", accountId);
        formData.set("status", e.target.value);
        startTransition(() => {
          updateClientStatus(formData);
        });
      }}
      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold capitalize text-ink outline-none focus:border-accent"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
