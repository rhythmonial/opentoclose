"use client";

import { useEffect, useState } from "react";
import { readContactFile, type ContactTable } from "@/lib/contactFiles";

// Reads an uploaded contacts file and shows every row of it.
export function ContactFileView({ url, fileName }: { url: string; fileName: string }) {
  const [table, setTable] = useState<ContactTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => readContactFile(blob, fileName))
      .then((t) => !cancelled && setTable(t))
      .catch(() => !cancelled && setError("Couldn't open this file."));
    return () => {
      cancelled = true;
    };
  }, [url, fileName]);

  const q = query.trim().toLowerCase();
  const rows = table
    ? table.rows.filter((r) => !q || r.some((v) => v.toLowerCase().includes(q)))
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold text-ink">{fileName}</h1>
          {table && (
            <p className="text-xs text-ink-faint">
              {table.rows.length} contact{table.rows.length === 1 ? "" : "s"} &middot;{" "}
              {table.columns.length} columns
              {q && ` · ${rows.length} match`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search contacts"
            className="w-56 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <a href={url} download={fileName} className="text-sm font-semibold text-accent">
            Download
          </a>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-danger">{error}</p>
      ) : !table ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-faint">
          Opening&hellip;
        </p>
      ) : (
        <div className="max-h-[80vh] overflow-auto rounded-xl border border-border bg-surface">
          <table className="text-left text-sm">
            <thead className="sticky top-0 bg-bg text-xs text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-semibold text-ink-faint">#</th>
                {table.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="px-3 py-1.5 text-xs text-ink-faint">{i + 1}</td>
                  {r.map((v, j) => (
                    <td key={j} className="max-w-[20rem] truncate px-3 py-1.5 text-ink" title={v}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
