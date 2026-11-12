"use client";

import { useEffect, useRef, useState } from "react";
import { readContactFile, type ContactTable } from "@/lib/contactFiles";
import { saveUploadMapping } from "@/app/configurator/upload_files/actions";

export type UploadedSheet = {
  id: string;
  fileName: string;
  columns: string[];
  rowCount: number;
  // Column → target key, plus "__imported" once its rows were added.
  mapping: Record<string, string | boolean | null>;
  url: string | null;
};

export type MapTarget = { key: string; label: string; aliases?: string[]; required?: boolean };

export const IMPORTED = "__imported";

const norm = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z]+/g, " ").trim();

// A first guess at each column's target, by its heading.
export function suggestTargets(columns: string[], targets: MapTarget[]) {
  const out: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const col of columns) {
    const c = norm(col);
    const hit = targets.find(
      (t) => !used.has(t.key) && [t.label, ...(t.aliases ?? [])].some((a) => norm(a) === c),
    );
    out[col] = hit?.key ?? null;
    if (hit) used.add(hit.key);
  }
  return out;
}

// An uploaded file (from Upload Your Messages / Tasks): each of its columns,
// a couple of examples, and what it's imported as. "Add" turns its rows into
// templates or tasks (checked to use), once.
export function UploadMapper({
  sheet,
  accountId,
  targets,
  noun,
  onImport,
}: {
  sheet: UploadedSheet;
  accountId: string | null;
  targets: MapTarget[];
  // "templates" or "tasks", for the button.
  noun: string;
  // Turns the file's rows into templates or tasks; returns how many.
  onImport: (table: ContactTable, mapping: Record<string, string | null>) => Promise<number>;
}) {
  const [table, setTable] = useState<ContactTable | null>(null);
  const [mapping, setMapping] = useState(() => {
    const m: Record<string, string | null> = {};
    const hasSaved = sheet.columns.some((c) => typeof sheet.mapping[c] === "string");
    const guess = hasSaved ? {} : suggestTargets(sheet.columns, targets);
    for (const c of sheet.columns) {
      const v = sheet.mapping[c];
      m[c] = typeof v === "string" ? v : (guess[c] ?? null);
    }
    return m;
  });
  const [imported, setImported] = useState(Boolean(sheet.mapping[IMPORTED]));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const loading = useRef(false);

  useEffect(() => {
    if (table || !sheet.url || loading.current) return;
    loading.current = true;
    fetch(sheet.url)
      .then((r) => r.blob())
      .then((blob) => readContactFile(blob, sheet.fileName))
      .then(setTable)
      .catch(() => setMessage("Couldn't read this file."));
  }, [table, sheet.url, sheet.fileName]);

  const missing = targets.filter((t) => t.required && !Object.values(mapping).includes(t.key));

  function choose(col: string, key: string | null) {
    const next = { ...mapping };
    if (key) for (const [c, k] of Object.entries(next)) if (k === key) next[c] = null;
    next[col] = key;
    setMapping(next);
    void saveUploadMapping(accountId, sheet.id, { ...next, [IMPORTED]: imported });
  }

  function examples(col: string) {
    if (!table) return null;
    const i = table.columns.indexOf(col);
    return table.rows.map((r) => r[i]).filter(Boolean).slice(0, 2);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{sheet.fileName}</p>
          <p className="text-xs text-ink-faint">
            {sheet.rowCount} row{sheet.rowCount === 1 ? "" : "s"}
            {missing.length > 0 && (
              <span className="font-semibold text-danger">
                {" "}
                &middot; Match {missing.map((t) => t.label).join(", ")}
              </span>
            )}
          </p>
        </div>
        {imported ? (
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
            Added
          </span>
        ) : (
          <button
            type="button"
            disabled={!table || missing.length > 0 || busy}
            onClick={async () => {
              if (!table) return;
              setBusy(true);
              setMessage(null);
              try {
                const n = await onImport(table, mapping);
                setImported(true);
                await saveUploadMapping(accountId, sheet.id, { ...mapping, [IMPORTED]: true });
                setMessage(`Added ${n} ${noun}.`);
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Couldn't add them.");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Adding…" : `Add these ${noun}`}
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-xs font-semibold text-ink">{message}</p>}

      {!imported && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-bg text-xs text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-semibold">Your column</th>
                <th className="px-3 py-2 font-semibold">Examples</th>
                <th className="px-3 py-2 font-semibold">Imported as</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sheet.columns.map((col) => {
                const target = mapping[col] ?? null;
                const ex = examples(col);
                return (
                  <tr key={col} className={target ? "" : "bg-bg/40"}>
                    <td className="px-3 py-2 font-medium text-ink">{col}</td>
                    <td className="max-w-[16rem] px-3 py-2 text-xs text-ink-soft">
                      {ex === null ? (
                        <span className="text-ink-faint">Loading&hellip;</span>
                      ) : ex.length === 0 ? (
                        <span className="text-ink-faint">(empty)</span>
                      ) : (
                        ex.map((v, i) => (
                          <span key={i} className="block truncate" title={v}>
                            {v}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={target ?? ""}
                        onChange={(e) => choose(col, e.target.value || null)}
                        aria-label={`What ${col} is`}
                        className={`w-full rounded-lg border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent ${
                          target ? "border-accent/40 text-ink" : "border-border text-ink-faint"
                        }`}
                      >
                        <option value="">Don&rsquo;t import</option>
                        {targets.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                            {t.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
