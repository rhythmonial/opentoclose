"use client";

import { useState, useTransition } from "react";
import { updateLeadStatus } from "@/app/dashboard/leads/actions";
import { LostReasonDialog } from "./LostReasonDialog";

const STATUSES = ["new", "contacted", "info_sent", "proposal_sent", "won", "lost"];

export function LeadStatusSelect({
  leadId,
  leadName,
  status,
}: {
  leadId: string;
  leadName: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(status);
  const [askLost, setAskLost] = useState(false);

  function save(next: string, lostReason?: string) {
    setValue(next);
    const formData = new FormData();
    formData.set("lead_id", leadId);
    formData.set("status", next);
    if (lostReason) formData.set("lost_reason", lostReason);
    startTransition(() => {
      updateLeadStatus(formData);
    });
  }

  return (
    <>
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => {
          if (e.target.value === "lost") setAskLost(true);
          else save(e.target.value);
        }}
        className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold capitalize text-ink outline-none focus:border-accent"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      {askLost && (
        <LostReasonDialog
          name={leadName}
          onCancel={() => setAskLost(false)}
          onSave={(reason) => {
            setAskLost(false);
            save("lost", reason);
          }}
        />
      )}
    </>
  );
}
