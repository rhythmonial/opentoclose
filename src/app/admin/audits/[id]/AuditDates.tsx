"use client";

import { useState } from "react";
import { formatYmd, reportDue } from "@/lib/audits";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const LABEL = "font-caption text-[11px] font-semibold uppercase tracking-wide text-ink-faint";

// The audit date picked here, and beside it the report due date (5
// business days later, as it's picked).
export function AuditDates({ initialAuditDate }: { initialAuditDate: string }) {
  const [auditDate, setAuditDate] = useState(initialAuditDate);
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Audit date</span>
        <input
          type="date"
          name="audit_date"
          value={auditDate}
          onChange={(e) => setAuditDate(e.target.value)}
          className={INPUT}
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className={LABEL}>Report due</span>
        <span className="py-2 text-ink">{auditDate ? formatYmd(reportDue(auditDate)) : "Pick an audit date"}</span>
      </div>
    </div>
  );
}
