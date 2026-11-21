"use client";

import { useState } from "react";
import { UPSELL_SERVICES, upsellCents } from "@/lib/audits";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// What the audit was upsold to, and beside it the amount (its first
// payment), filled in from the service.
export function UpsellFields({ initial }: { initial: string }) {
  const [service, setService] = useState(initial);
  const cents = upsellCents(service);
  return (
    <div className="grid grid-cols-2 gap-x-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Upsell service</span>
        <select name="upsell_service" value={service} onChange={(e) => setService(e.target.value)} className={INPUT}>
          <option value="">None</option>
          {UPSELL_SERVICES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Amount</span>
        <span className="py-2 text-sm text-ink">
          {cents === null ? "—" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          {service === "setup" && <span className="text-xs text-ink-faint"> (setup + first month)</span>}
          {service === "diy" && <span className="text-xs text-ink-faint"> (first month)</span>}
        </span>
      </div>
    </div>
  );
}
