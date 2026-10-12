"use client";

import { useTransition } from "react";
import { updateLeadStatus } from "@/app/dashboard/leads/actions";

const STATUSES = ["new", "contacted", "info_sent", "proposal_sent", "won", "lost"];

export function LeadStatusSelect({
  leadId,
  status,
}: {
  leadId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("lead_id", leadId);
        formData.set("status", e.target.value);
        startTransition(() => {
          updateLeadStatus(formData);
        });
      }}
      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold capitalize text-ink outline-none focus:border-accent"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
