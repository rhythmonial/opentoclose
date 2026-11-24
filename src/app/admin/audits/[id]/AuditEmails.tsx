"use client";

import { useState } from "react";
import { AUDIT_EMAILS, fillAuditEmail, type AuditEmailFields } from "@/lib/auditEmails";
import { EmailDraftLink } from "@/components/EmailDraftLink";

// Pick an email template and Send: it drafts the email (the email app on a
// phone, Gmail in a new tab on a computer) with the to, subject and body
// filled in from this request.
export function AuditEmails({ email, fields }: { email: string; fields: AuditEmailFields }) {
  const [key, setKey] = useState("");
  const template = AUDIT_EMAILS.find((t) => t.key === key);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={key}
        onChange={(e) => setKey(e.target.value)}
        aria-label="Email template"
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent ${
          key ? "text-ink" : "text-ink-faint"
        }`}
      >
        <option value="">Choose an email template&hellip;</option>
        {AUDIT_EMAILS.map((t) => (
          <option key={t.key} value={t.key} className="text-ink">
            {t.label}
          </option>
        ))}
      </select>
      {template ? (
        <EmailDraftLink
          to={email}
          subject={fillAuditEmail(template.subject, fields)}
          body={fillAuditEmail(template.body, fields)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Send
        </EmailDraftLink>
      ) : (
        <span className="cursor-not-allowed rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white opacity-50">
          Send
        </span>
      )}
    </div>
  );
}
