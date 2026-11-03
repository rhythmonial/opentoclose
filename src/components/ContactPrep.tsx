"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import {
  CONTACT_FILE_ACCEPT,
  contentTypeOf,
  extensionOf,
  readContactFile,
  type ContactTable,
} from "@/lib/contactFiles";
import {
  FULL_NAME,
  FULL_NAME_LABEL,
  OTC_CONTACT_FIELDS,
  suggestMapping,
  toOtcRows,
  type ContactMapping,
} from "@/lib/otcContactFields";
import {
  recordContactFile,
  removeContactFile,
  saveContactMapping,
} from "@/app/configurator/prep_contact_roles_for_setup/actions";

export type ContactFile = {
  id: string;
  fileName: string;
  columns: string[];
  rowCount: number;
  mapping: ContactMapping;
  // A signed link to the original file.
  url: string | null;
};

// Prep Your Contacts: the client uploads their contact lists in whatever
// format they have (CSV, Excel, vCard...), then matches each of their
// columns to OTC's contact import fields. Staff can download each list
// rearranged into OTC's import layout.
export function ContactPrep({
  accountId,
  isStaff,
  initialFiles,
}: {
  // The client account the files belong to.
  accountId: string;
  isStaff: boolean;
  initialFiles: ContactFile[];
}) {
  const [files, setFiles] = useState(initialFiles);
  const [tables, setTables] = useState(new Map<string, ContactTable>());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actionAccount = isStaff ? accountId : null;

  async function upload(file: File) {
    setError(null);
    setBusy(`Reading ${file.name}…`);
    try {
      const table = await readContactFile(file, file.name);
      if (table.columns.length === 0) throw new Error("We couldn't find any contacts in that file.");
      setBusy(`Uploading ${file.name}…`);
      const ext = extensionOf(file.name) || "csv";
      const storagePath = `${accountId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await createClient()
        .storage.from("contact-files")
        .upload(storagePath, file, { contentType: contentTypeOf(file.name) });
      if (uploadError) throw new Error(uploadError.message);
      const mapping = suggestMapping(table.columns);
      const result = await recordContactFile(actionAccount, {
        fileName: file.name,
        storagePath,
        columns: table.columns,
        rowCount: table.rows.length,
        mapping,
      });
      if (!result.ok || !result.id) throw new Error(result.error ?? "Couldn't save that file.");
      const id = result.id;
      setTables((all) => new Map(all).set(id, table));
      setFiles((all) => [
        ...all,
        { id, fileName: file.name, columns: table.columns, rowCount: table.rows.length, mapping, url: null },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-8 text-center hover:border-accent">
        <span className="text-sm font-semibold text-ink">
          {busy ?? "Upload a contacts file"}
        </span>
        <span className="text-xs text-ink-faint">
          CSV, Excel (.xlsx), vCard (.vcf) or a text export from your CRM, phone or email.
          You can upload more than one.
        </span>
        <input
          type="file"
          accept={CONTACT_FILE_ACCEPT}
          disabled={Boolean(busy)}
          className="text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {files.map((f) => (
        <ContactFileCard
          key={f.id}
          file={f}
          table={tables.get(f.id) ?? null}
          isStaff={isStaff}
          onTable={(t) => setTables((all) => new Map(all).set(f.id, t))}
          onMapping={(mapping) => {
            setFiles((all) => all.map((x) => (x.id === f.id ? { ...x, mapping } : x)));
            return saveContactMapping(actionAccount, f.id, mapping);
          }}
          onRemove={async () => {
            setFiles((all) => all.filter((x) => x.id !== f.id));
            await removeContactFile(actionAccount, f.id);
          }}
        />
      ))}
    </div>
  );
}

const NAME_TARGETS = new Set(["First Name", "Last Name", FULL_NAME, "Business Name"]);

// One uploaded file: each of its columns, a few examples from it, and the
// OTC field it matches.
function ContactFileCard({
  file,
  table,
  isStaff,
  onTable,
  onMapping,
  onRemove,
}: {
  file: ContactFile;
  table: ContactTable | null;
  isStaff: boolean;
  onTable: (t: ContactTable) => void;
  onMapping: (m: ContactMapping) => Promise<{ ok: boolean }>;
  onRemove: () => void;
}) {
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const loading = useRef(false);

  // Files saved earlier are read again for their examples.
  useEffect(() => {
    if (table || !file.url || loading.current) return;
    loading.current = true;
    fetch(file.url)
      .then((r) => r.blob())
      .then((blob) => readContactFile(blob, file.fileName))
      .then(onTable)
      .catch(() => {});
  }, [table, file.url, file.fileName, onTable]);

  const matched = file.columns.filter((c) => file.mapping[c]).length;
  const hasName = Object.values(file.mapping).some((t) => t && NAME_TARGETS.has(t));
  const usedBy = new Map(
    Object.entries(file.mapping)
      .filter(([, t]) => t)
      .map(([col, t]) => [t!, col] as const),
  );

  function examples(col: string) {
    if (!table) return null;
    const i = table.columns.indexOf(col);
    return table.rows
      .map((r) => r[i])
      .filter(Boolean)
      .slice(0, 2);
  }

  function choose(col: string, target: string | null) {
    const next: ContactMapping = { ...file.mapping };
    // An OTC field matches one column; picking it here frees it elsewhere.
    if (target) {
      for (const [c, t] of Object.entries(next)) if (t === target) next[c] = null;
    }
    next[col] = target;
    setStatus("saving");
    void onMapping(next).then((r) => setStatus(r.ok ? "saved" : "error"));
  }

  function downloadOtc() {
    if (!table) return;
    const csv = Papa.unparse(toOtcRows(table.columns, table.rows, file.mapping));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.fileName.replace(/\.[^.]+$/, "")} - OTC import.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{file.fileName}</p>
          <p className="text-xs text-ink-faint">
            {file.rowCount} contact{file.rowCount === 1 ? "" : "s"} &middot; {matched} of{" "}
            {file.columns.length} columns matched
            {!hasName && (
              <span className="font-semibold text-danger"> &middot; Match a name column</span>
            )}
            {status === "saving" && " · Saving…"}
            {status === "saved" && " · Saved"}
            {status === "error" && <span className="text-danger"> · Couldn&rsquo;t save</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {isStaff && file.url && (
            <a href={file.url} className="text-accent" download={file.fileName}>
              Original file
            </a>
          )}
          {isStaff && (
            <button
              type="button"
              disabled={!table}
              onClick={downloadOtc}
              className="rounded-md border border-border px-2.5 py-1 text-accent disabled:opacity-50"
            >
              Download in OTC import format
            </button>
          )}
          {confirming ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md bg-danger px-2.5 py-1 text-white"
            >
              Delete?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-ink-faint hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-bg text-xs text-ink-soft">
            <tr>
              <th className="px-3 py-2 font-semibold">Your column</th>
              <th className="px-3 py-2 font-semibold">Examples</th>
              <th className="px-3 py-2 font-semibold">OTC import field</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {file.columns.map((col) => {
              const target = file.mapping[col] ?? null;
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
                      aria-label={`OTC field for ${col}`}
                      className={`w-full rounded-lg border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent ${
                        target ? "border-accent/40 text-ink" : "border-border text-ink-faint"
                      }`}
                    >
                      <option value="">Don&rsquo;t import</option>
                      {[FULL_NAME, ...OTC_CONTACT_FIELDS].map((t) => {
                        const other = usedBy.get(t);
                        return (
                          <option key={t} value={t}>
                            {t === FULL_NAME ? FULL_NAME_LABEL : t}
                            {other && other !== col ? ` (now: ${other})` : ""}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
