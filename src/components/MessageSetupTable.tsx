"use client";

import { useState } from "react";
import { IMPORT_COLUMNS, normalizeMergeFields, toImportCsv, type ImportedTemplate } from "@/lib/emailImportSheet";
import { DownloadCsvButton } from "@/components/CopyButton";

// Message Setup: every template they're using in one list (title expands
// the message), with the CSV in Open to Close's import columns.
export function MessageSetupTable({ templates }: { templates: ImportedTemplate[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (templates.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
        No templates checked to use yet. Check the ones you&rsquo;ll use in Prep Your Messages.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-soft">
          {templates.length} template{templates.length === 1 ? "" : "s"} &middot; columns:{" "}
          {IMPORT_COLUMNS.join(", ")}
        </span>
        <DownloadCsvButton
          csv={toImportCsv(templates)}
          fileName="Email Templates - OTC import.csv"
          label="Download CSV for Open to Close"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2.5">Title</th>
              <th className="px-3 py-2.5">Subject</th>
              <th className="px-3 py-2.5">To</th>
              <th className="px-3 py-2.5">Cc</th>
              <th className="px-3 py-2.5">Bcc</th>
              <th className="px-3 py-2.5">File roles</th>
            </tr>
          </thead>
          <tbody>
            {templates.flatMap((t, i) => [
              <tr key={i} className="border-b border-border-soft align-top">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setOpen(open === i ? null : i)}
                    aria-expanded={open === i}
                    className="flex items-center gap-1.5 text-left font-semibold text-ink hover:text-accent"
                  >
                    <span aria-hidden className={`text-ink-faint transition-transform ${open === i ? "rotate-90" : ""}`}>
                      &rsaquo;
                    </span>
                    {t.title}
                  </button>
                </td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-ink-soft">{normalizeMergeFields(t.subject)}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{t.to.join(", ")}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{t.cc.join(", ")}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{t.bcc.join(", ")}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{t.files.join(", ")}</td>
              </tr>,
              open === i && (
                <tr key={`${i}-body`} className="border-b border-border-soft">
                  <td colSpan={6} className="whitespace-pre-wrap bg-bg/50 px-6 py-3 text-sm text-ink">
                    {normalizeMergeFields(t.body)}
                  </td>
                </tr>
              ),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
