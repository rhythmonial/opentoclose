"use client";

import { useState } from "react";
import { AUDIT_EMAILS, fillAuditEmail, type AuditEmailFields } from "@/lib/auditEmails";

// Pick an email template and Send: it opens in your email app with the
// to, subject and body filled in from this request.
export function AuditEmails({ email, fields }: { email: string; fields: AuditEmailFields }) {
  const [key, setKey] = useState("");
  const template = AUDIT_EMAILS.find((t) => t.key === key);
  const href = template
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
        fillAuditEmail(template.subject, fields),
      )}&body=${encodeURIComponent(fillAuditEmail(template.body, fields))}`
    : undefined;
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
      {href ? (
        <a href={href} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
          Send
        </a>
      ) : (
        <span className="cursor-not-allowed rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white opacity-50">
          Send
        </span>
      )}
    </div>
  );
}
