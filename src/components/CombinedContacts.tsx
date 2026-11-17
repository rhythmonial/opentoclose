"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { readContactFile } from "@/lib/contactFiles";
import { OTC_CONTACT_FIELDS, toOtcRows, type ContactMapping } from "@/lib/otcContactFields";
import { DownloadCsvButton } from "@/components/CopyButton";

export type ContactSource = { id: string; fileName: string; url: string | null; mapping: ContactMapping };

// Contact Setup: every contact from their uploaded lists, combined in Open
// to Close's contact import columns (from how they matched each list), to
// see and download as one CSV for OTC's import.
export function CombinedContacts({ files }: { files: ContactSource[] }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: string[][] = [];
      for (const f of files) {
        if (!f.url) continue;
        try {
          const blob = await (await fetch(f.url)).blob();
          const table = await readContactFile(blob, f.fileName);
          all.push(...toOtcRows(table.columns, table.rows, f.mapping).slice(1));
        } catch {
          if (!cancelled) setError(`Couldn't read ${f.fileName}.`);
        }
      }
      if (!cancelled) setRows(all);
    })();
    return () => {
      cancelled = true;
    };
  }, [files]);

  if (files.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
        No contact lists yet. Upload them in Upload Your Contacts and match their columns in Prep
        Your Contacts.
      </p>
    );
  }
  if (!rows) return <p className="text-sm text-ink-faint">Combining your contacts&hellip;</p>;

  // Only the columns with something in them, in OTC's order.
  const used = OTC_CONTACT_FIELDS.map((_, i) => i).filter((i) => rows.some((r) => r[i]));
  const shown = rows.slice(0, 300);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-soft">
          {rows.length} contact{rows.length === 1 ? "" : "s"} from {files.length} list
          {files.length === 1 ? "" : "s"}
        </span>
        <DownloadCsvButton
          csv={Papa.unparse([[...OTC_CONTACT_FIELDS], ...rows])}
          fileName="Contacts - OTC import.csv"
          label="Download CSV for Open to Close"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border-soft bg-bg font-semibold text-ink-soft">
              {used.map((i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2">
                  {OTC_CONTACT_FIELDS[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, n) => (
              <tr key={n} className="border-b border-border-soft last:border-0">
                {used.map((i) => (
                  <td key={i} className="max-w-[16rem] truncate px-3 py-1.5 text-ink" title={r[i]}>
                    {r[i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="text-xs text-ink-faint">
          Showing the first {shown.length}. The download has all {rows.length}.
        </p>
      )}
    </div>
  );
}
