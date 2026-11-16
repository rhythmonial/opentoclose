"use client";

import { useEffect, useRef, useState } from "react";
import { readContactFile, type ContactTable } from "@/lib/contactFiles";
import { saveUploadMapping } from "@/app/configurator/upload_files/actions";
import { findMergeFields, mergeName } from "@/lib/emailImportSheet";

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
// Merge field renames ({ old_name: new_name }), saved as JSON.
const RENAMES = "__renames";

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
  initialTable = null,
  mergeFieldTargets,
  mergeSuggestions = [],
}: {
  sheet: UploadedSheet;
  accountId: string | null;
  targets: MapTarget[];
  // "templates" or "tasks", for the button.
  noun: string;
  // Turns the file's rows into templates or tasks (with any merge field
  // renames); returns how many.
  onImport: (
    table: ContactTable,
    mapping: Record<string, string | null>,
    renames: Record<string, string>,
  ) => Promise<number>;
  // The file as just picked (so it needn't be downloaded again).
  initialTable?: ContactTable | null;
  // Targets whose text has merge fields (e.g. subject, body): the merge
  // fields found there are listed to clean up before adding.
  mergeFieldTargets?: string[];
  // Merge field names to suggest when renaming.
  mergeSuggestions?: string[];
}) {
  const [table, setTable] = useState<ContactTable | null>(initialTable);
  const [renames, setRenames] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(String(sheet.mapping[RENAMES] ?? "{}"));
    } catch {
      return {};
    }
  });
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

  function persist(nextMapping: Record<string, string | null>, nextRenames: Record<string, string>) {
    void saveUploadMapping(accountId, sheet.id, {
      ...nextMapping,
      [IMPORTED]: imported,
      [RENAMES]: JSON.stringify(nextRenames),
    });
  }

  function choose(col: string, key: string | null) {
    const next = { ...mapping };
    if (key) for (const [c, k] of Object.entries(next)) if (k === key) next[c] = null;
    next[col] = key;
    setMapping(next);
    persist(next, renames);
  }

  // The merge fields in the columns that hold them (subject, body…).
  const mergeCols = (mergeFieldTargets ?? []).flatMap((key) => {
    const i = table?.columns.findIndex((c) => mapping[c] === key) ?? -1;
    return i >= 0 ? [i] : [];
  });
  const found =
    table && mergeCols.length > 0
      ? findMergeFields(table.rows.flatMap((r) => mergeCols.map((i) => r[i] ?? "")))
      : [];
  const listId = `merge-suggestions-${sheet.id}`;

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
                const n = await onImport(table, mapping, renames);
                setImported(true);
                await saveUploadMapping(accountId, sheet.id, {
                  ...mapping,
                  [IMPORTED]: true,
                  [RENAMES]: JSON.stringify(renames),
                });
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

      {!imported && found.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-ink">Merge fields in this file ({found.length})</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            They&rsquo;re all written as {"{{merge_field}}"} when added. Rename any to match the
            merge field you use (or to clean up spelling); leave the rest as they are.
          </p>
          <datalist id={listId}>
            {mergeSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-bg text-xs text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-semibold">In your file</th>
                  <th className="px-3 py-2 font-semibold">Used</th>
                  <th className="px-3 py-2 font-semibold">Becomes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {found.map((f) => (
                  <tr key={f.name}>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{`{{${f.name}}}`}</td>
                    <td className="px-3 py-2 text-xs text-ink-faint">
                      {f.count} time{f.count === 1 ? "" : "s"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 font-mono text-xs text-ink-soft">
                        {"{{"}
                        <input
                          list={listId}
                          value={renames[f.name] ?? f.name}
                          onChange={(e) => {
                            const value = e.target.value;
                            setRenames((all) => {
                              const next = { ...all };
                              if (!value.trim() || mergeName(value) === f.name) delete next[f.name];
                              else next[f.name] = value;
                              return next;
                            });
                          }}
                          onBlur={() => persist(mapping, renames)}
                          aria-label={`Rename ${f.name}`}
                          className={`w-full min-w-0 rounded-md border bg-bg px-2 py-1 font-mono text-xs outline-none focus:border-accent ${
                            renames[f.name] ? "border-accent/50 text-ink" : "border-border text-ink-soft"
                          }`}
                        />
                        {"}}"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
