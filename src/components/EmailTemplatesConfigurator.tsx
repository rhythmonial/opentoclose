"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  BREAK,
  withBlankLines,
  fromSample,
  isEdited,
  SIDE_LABELS,
  sideOf,
  sampleFor,
  type EmailTemplate,
  type TemplateSide,
} from "@/lib/emailTemplates";
import {
  importEmailTemplates,
  removeEmailTemplate,
  saveEmailTemplate,
} from "@/app/configurator/sample_email_templates/actions";
import { downloadCsv, toImportCsv, type ImportedTemplate } from "@/lib/emailImportSheet";
import { UploadMapper, type MapTarget, type UploadedSheet } from "@/components/UploadMapper";
import type { ContactTable } from "@/lib/contactFiles";

type Item = EmailTemplate & { key: string };

// What an uploaded message file's columns can be imported as.
const MESSAGE_TARGETS: MapTarget[] = [
  { key: "title", label: "Title (template name)", aliases: ["title", "name", "template", "template name"], required: true },
  { key: "subject", label: "Subject", aliases: ["subject", "subject line"] },
  { key: "body", label: "Body (message)", aliases: ["body", "message", "content", "text"] },
  { key: "to", label: "To roles", aliases: ["to", "to roles", "recipients"] },
  { key: "cc", label: "Cc roles", aliases: ["cc", "cc roles"] },
  { key: "bcc", label: "Bcc roles", aliases: ["bcc", "bcc roles"] },
  { key: "files", label: "File roles (attachments)", aliases: ["files", "file roles", "attachments"] },
];

// An uploaded file's rows as templates, by how its columns were matched.
function templatesFrom(table: ContactTable, mapping: Record<string, string | null>): ImportedTemplate[] {
  const colOf = (key: string) => table.columns.findIndex((c) => mapping[c] === key);
  const get = (row: string[], key: string) => {
    const i = colOf(key);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };
  const list = (v: string) => [...new Set(v.split(",").map((x) => x.trim()).filter(Boolean))];
  return table.rows
    .map((row) => ({
      title: get(row, "title"),
      subject: get(row, "subject"),
      body: withBlankLines(get(row, "body")).trim(),
      to: list(get(row, "to")),
      cc: list(get(row, "cc")),
      bcc: list(get(row, "bcc")),
      files: list(get(row, "files")),
    }))
    .filter((t) => t.title);
}

const SIDE_ORDER: TemplateSide[] = ["buyer", "seller", "listing", "other"];

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// Sample Email Templates: the sample templates (and any of the client's
// own), shown as finished emails. Each can be used or not, and edited:
// title, subject, body, who it goes to (To / Cc / Bcc, from the contact
// roles) and the documents attached (from their documents).
export function EmailTemplatesConfigurator({
  accountId,
  uploads = [],
  initial,
  roleOptions,
  fileOptions,
  defaultFiles,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  // Message files they uploaded in Upload Your Messages.
  uploads?: UploadedSheet[];
  initial: EmailTemplate[];
  roleOptions: string[];
  fileOptions: string[];
  // The documents each sample starts with attached (by sample key).
  defaultFiles: Record<string, string[]>;
}) {
  const filesFor = (t: EmailTemplate) => (t.sampleKey ? (defaultFiles[t.sampleKey] ?? []) : []);
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((t) => ({ ...t, key: t.sampleKey ?? t.id ?? crypto.randomUUID() })),
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<TemplateSide | "all">("all");
  const [onlyUsed, setOnlyUsed] = useState(false);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);

  // Adds an uploaded file's rows as their own templates (checked to use),
  // at the top.
  async function importRows(table: ContactTable, mapping: Record<string, string | null>) {
    const rows = templatesFrom(table, mapping);
    const result = await importEmailTemplates(accountId, rows);
    if (!result.ok || !result.templates) throw new Error(result.error ?? "Couldn't add them.");
    const added = result.templates.map((t) => ({ ...t, key: t.id ?? crypto.randomUUID() }));
    setItems((all) => [...added, ...all]);
    setQuery("");
    setSide("all");
    return added.length;
  }

  async function persist(item: Item) {
    setStatus("saving");
    const result = await saveEmailTemplate(accountId, item);
    setStatus(result.ok ? "saved" : "error");
    if (result.ok && result.id && !item.id) {
      setItems((all) => all.map((x) => (x.key === item.key ? { ...x, id: result.id! } : x)));
    }
    return result.ok;
  }

  function update(key: string, change: Partial<EmailTemplate>) {
    const item = items.find((x) => x.key === key);
    if (!item) return;
    const next = { ...item, ...change };
    setItems((all) => all.map((x) => (x.key === key ? next : x)));
    void persist(next);
  }

  async function reset(item: Item) {
    const sample = sampleFor(item.sampleKey);
    if (!sample) return;
    setItems((all) =>
      all.map((x) =>
        x.key === item.key ? { ...fromSample(sample, filesFor(item)), key: x.key } : x,
      ),
    );
    setEditingKey(null);
    if (item.id) await removeEmailTemplate(accountId, item.id);
  }

  async function remove(item: Item) {
    setItems((all) => all.filter((x) => x.key !== item.key));
    if (item.id) await removeEmailTemplate(accountId, item.id);
  }

  function addTemplate() {
    const item: Item = {
      key: crypto.randomUUID(),
      id: null,
      sampleKey: null,
      include: true,
      title: "New template",
      subject: "",
      body: "",
      to: [],
      cc: [],
      bcc: [],
      files: [],
    };
    setItems((all) => [item, ...all]);
    setOpenKey(item.key);
    setEditingKey(item.key);
    setQuery("");
    setSide("all");
  }

  const q = query.trim().toLowerCase();
  const shown = items.filter(
    (t) =>
      (side === "all" || sideOf(t.title) === side) &&
      (!onlyUsed || t.include) &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)),
  );
  const used = items.filter((t) => t.include).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="w-64 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addTemplate}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white"
            >
              + New template
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <button
            type="button"
            disabled={used === 0}
            onClick={() =>
              downloadCsv(
                toImportCsv(items.filter((t) => t.include)),
                "My Email Templates - OTC import.csv",
              )
            }
            className="font-semibold text-accent disabled:opacity-50"
          >
            Download the ones I&rsquo;m using (OTC import format)
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(["all", "buyer", "seller", "listing", "other"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${
                  side === s
                    ? "border-accent bg-accent text-white"
                    : "border-border text-ink-soft hover:border-accent"
                }`}
              >
                {s === "all" ? "All" : SIDE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-soft">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={onlyUsed}
                onChange={(e) => setOnlyUsed(e.target.checked)}
              />
              Only ones I&rsquo;m using
            </label>
            <span className="text-xs text-ink-faint">
              Using {used} of {items.length}
              {status === "saving" && " · Saving…"}
              {status === "saved" && " · Saved"}
              {status === "error" && <span className="text-danger"> · Couldn&rsquo;t save</span>}
            </span>
          </div>
        </div>
      </div>

      {uploads.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold text-ink">Your uploaded messages</h2>
          <p className="-mt-1 text-xs text-ink-faint">
            Match each file&rsquo;s columns, then add its templates. They come in checked to use.
          </p>
          {uploads.map((u) => (
            <UploadMapper
              key={u.id}
              sheet={u}
              accountId={accountId}
              targets={MESSAGE_TARGETS}
              noun="templates"
              onImport={importRows}
            />
          ))}
        </section>
      )}

      {(() => {
        const renderRow = (t: Item) => {
          const open = openKey === t.key;
          const editing = editingKey === t.key;
          const edited = isEdited(t, filesFor(t));
          return [
            <tr key={t.key} className={`border-b border-border-soft align-top ${t.include ? "" : "bg-bg/50"}`}>
              <td className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={t.include}
                  onChange={(e) => update(t.key, { include: e.target.checked })}
                  aria-label={`Use ${t.title}`}
                  title="Use this template"
                  className="h-4 w-4"
                />
              </td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpenKey(open ? null : t.key);
                    if (open) setEditingKey(null);
                  }}
                  aria-expanded={open}
                  className="flex items-center gap-2 text-left"
                >
                  <span aria-hidden className={`text-ink-faint transition-transform ${open ? "rotate-90" : ""}`}>
                    &rsaquo;
                  </span>
                  <span className={`font-semibold hover:text-accent ${t.include ? "text-ink" : "text-ink-faint"}`}>
                    {t.title}
                  </span>
                  {edited && (
                    <span className="rounded bg-gold/20 px-1.5 py-px text-[10px] font-bold uppercase text-ink">
                      Edited
                    </span>
                  )}
                </button>
              </td>
              <td className="max-w-[18rem] truncate px-3 py-2.5 text-ink-soft">
                <Inline text={t.subject || "(no subject)"} />
              </td>
              <td className="px-3 py-2.5 text-xs text-ink-faint">{t.to.join(", ") || "\u2014"}</td>
            </tr>,
            open && (
              <tr key={`${t.key}-open`} className="border-b border-border-soft">
                <td colSpan={4} className="p-0">
                  <div className="border-t border-border px-4 pb-4 pt-3">
                  {/* Who it goes to and what's attached, changed right here
                      (and saved as they change). */}
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MultiSelect label="To" options={roleOptions} value={t.to} onChange={(to) => update(t.key, { to })} />
                    <MultiSelect label="Cc" options={roleOptions} value={t.cc} onChange={(cc) => update(t.key, { cc })} />
                    <MultiSelect label="Bcc" options={roleOptions} value={t.bcc} onChange={(bcc) => update(t.key, { bcc })} />
                    <MultiSelect
                      label="Attach documents"
                      options={fileOptions}
                      value={t.files}
                      onChange={(files) => update(t.key, { files })}
                      emptyText="No documents yet. Add them in Categorize Your Documents."
                    />
                  </div>
                  {editing ? (
                    <TemplateEditor
                      template={t}
                      onCancel={() => {
                        setEditingKey(null);
                        if (!t.id && !t.sampleKey) remove(t);
                      }}
                      onSave={async (change) => {
                        const next = { ...t, ...change };
                        setItems((all) => all.map((x) => (x.key === t.key ? next : x)));
                        if (await persist(next)) setEditingKey(null);
                      }}
                    />
                  ) : (
                    <>
                      <EmailPreview template={t} />
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingKey(t.key)}
                          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white"
                        >
                          Edit
                        </button>
                        {edited && (
                          <ConfirmButton label="Reset to sample" confirm="Reset?" onConfirm={() => reset(t)} />
                        )}
                        {!t.sampleKey && (
                          <ConfirmButton label="Delete" confirm="Delete?" onConfirm={() => remove(t)} />
                        )}
                      </div>
                    </>
                  )}
                </div>
                </td>
              </tr>
            ),
          ];
        };
        // A table of templates grouped by type (buyer, seller, listing, other).
        const renderTable = (list: Item[], heading: string, empty: string) => (
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold text-ink">
              {heading} ({list.length})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2.5">Use</th>
                    <th className="px-3 py-2.5">Template</th>
                    <th className="px-3 py-2.5">Subject</th>
                    <th className="px-3 py-2.5">To</th>
                  </tr>
                </thead>
                <tbody>
                  {SIDE_ORDER.flatMap((sd) => {
                    const rows = list.filter((t) => sideOf(t.title) === sd);
                    if (rows.length === 0) return [];
                    return [
                      <tr key={`h-${heading}-${sd}`} className="border-b border-border-soft bg-accent-soft/40">
                        <td colSpan={4} className="px-3 py-1.5 font-caption text-xs font-bold uppercase tracking-wide text-accent">
                          {SIDE_LABELS[sd]} ({rows.length})
                        </td>
                      </tr>,
                      ...rows.flatMap(renderRow),
                    ];
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-sm text-ink-faint">
                        {empty}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
        return (
          <>
            {renderTable(
              shown.filter((t) => !t.sampleKey),
              "Your templates",
              "None yet. Add the ones from your uploaded files above, or start a new one.",
            )}
            {renderTable(shown.filter((t) => t.sampleKey), "Sample templates", "No samples match.")}
          </>
        );
      })()}
    </div>
  );
}

function ConfirmButton({
  label,
  confirm,
  onConfirm,
}: {
  label: string;
  confirm: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <button
      type="button"
      onClick={onConfirm}
      className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white"
    >
      {confirm}
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setArmed(true)}
      className="text-sm font-semibold text-ink-soft hover:text-danger"
    >
      {label}
    </button>
  );
}

// Merge fields ({{closing_date}}) as tags, and placeholders to fill in
// (<agent first name>) highlighted.
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*[^}]+?\s*\}\}|<[a-z][a-z ]{1,40}>)/gi);
  return (
    <>
      {parts.map((p, i) => {
        const field = p.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
        if (field) {
          return (
            <span
              key={i}
              title={`Merge field: ${field[1]}`}
              className="mx-px inline-block rounded bg-accent-soft/70 px-1 font-mono text-[0.8em] text-accent"
            >
              {field[1].replace(/_/g, " ")}
            </span>
          );
        }
        if (/^<[a-z][a-z ]{1,40}>$/i.test(p)) {
          return (
            <span
              key={i}
              title="Fill this in"
              className="mx-px inline-block rounded bg-gold/30 px-1 text-[0.85em] font-semibold text-ink"
            >
              {p.slice(1, -1)}
            </span>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

// A body as it reads in an email: blank lines (or old ADDABREAK lines)
// start new paragraphs,
// runs of lines starting "-" are a list, and an OTC contact block
// ([START_CONTACT] ... [END_CONTACT]) shows as a contact card.
function Body({ body }: { body: string }) {
  const blocks: string[][] = [[]];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const current = blocks[blocks.length - 1];
    if (line === BREAK || (line === "" && current.length > 0)) blocks.push([]);
    else if (line !== "") current.push(line);
  }
  const nonEmpty = blocks.filter((b) => b.length > 0);
  if (nonEmpty.length === 0) return <p className="text-sm text-ink-faint">(no message yet)</p>;

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink">
      {nonEmpty.map((lines, i) => (
        <Block key={i} lines={lines} />
      ))}
    </div>
  );
}

// One paragraph's lines, grouped into text, lists and contact cards.
function Block({ lines }: { lines: string[] }) {
  type Part = { kind: "text" | "list" | "contact"; lines: string[] };
  const parts: Part[] = [];
  let inContact = false;
  for (const line of lines) {
    if (/^\[START_CONTACT\]$/i.test(line)) {
      inContact = true;
      parts.push({ kind: "contact", lines: [] });
      continue;
    }
    if (/^\[END_CONTACT\]$/i.test(line)) {
      inContact = false;
      continue;
    }
    const kind = inContact ? "contact" : /^[-•]\s?/.test(line) ? "list" : "text";
    const last = parts[parts.length - 1];
    const text = kind === "list" ? line.replace(/^[-•]\s?/, "") : line;
    if (last && last.kind === kind) last.lines.push(text);
    else parts.push({ kind, lines: [text] });
  }
  return (
    <div className="flex flex-col gap-1">
      {parts.map((part, i) =>
        part.kind === "list" ? (
          <ul key={i} className="list-disc pl-5">
            {part.lines.map((l, j) => (
              <li key={j}>
                <Inline text={l} />
              </li>
            ))}
          </ul>
        ) : part.kind === "contact" ? (
          <div key={i} className="w-fit rounded-lg border border-border bg-bg/60 px-3 py-2 text-[13px]">
            {part.lines.map((l, j) => (
              <span key={j} className="block">
                <Inline text={l} />
              </span>
            ))}
          </div>
        ) : (
          <p key={i}>
            {part.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline text={l} />
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

// The email as it reads: subject, then body.
function EmailPreview({ template: t }: { template: EmailTemplate }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="border-b border-border bg-bg/60 px-4 py-3 text-sm">
        <p className="font-semibold text-ink">
          <Inline text={t.subject || "(no subject)"} />
        </p>
      </div>
      <div className="px-4 py-4">
        <Body body={t.body} />
      </div>
    </div>
  );
}

// The words: title, subject and body (recipients and attachments are
// changed above it).
function TemplateEditor({
  template,
  onSave,
  onCancel,
}: {
  template: EmailTemplate;
  onSave: (change: Partial<EmailTemplate>) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(template);
  const [saving, setSaving] = useState(false);
  const set = (change: Partial<EmailTemplate>) => setDraft((d) => ({ ...d, ...change }));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
          title: draft.title,
          subject: draft.subject,
          body: withBlankLines(draft.body),
        });
        setSaving(false);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-soft">Title (template name)</span>
        <input
          required
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          maxLength={200}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-soft">Subject</span>
        <input
          value={draft.subject}
          onChange={(e) => set({ subject: e.target.value })}
          maxLength={500}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-soft">Body (message)</span>
        <textarea
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          rows={Math.min(24, Math.max(8, draft.body.split("\n").length + 2))}
          className={`${inputClass} font-mono text-[13px] leading-relaxed`}
        />
        <span className="text-xs text-ink-faint">
          Leave a blank line between paragraphs; that&rsquo;s how they come through in Open
          to Close. Merge fields look like{" "}
          <code className="rounded bg-bg px-1">{"{{closing_date}}"}</code>.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save template"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-soft">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Chips for what's chosen, and a searchable checklist to choose more.
function MultiSelect({
  label,
  options,
  value,
  onChange,
  emptyText = "Nothing to choose from yet.",
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  // Choices saved earlier that aren't options any more still show, so they
  // can be taken off.
  const all = [...new Set([...options, ...value])];
  const shown = all.filter((o) => !q || o.toLowerCase().includes(q));
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <div className="flex min-h-[2.4rem] flex-wrap items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1.5">
        {value.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-px text-xs text-ink"
          >
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => toggle(v)} className="text-ink-faint hover:text-ink">
              &times;
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="text-xs font-semibold text-accent"
        >
          + Add
        </button>
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 flex w-full min-w-60 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label={`Search ${label}`}
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <div className="max-h-56 overflow-y-auto">
            {shown.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-ink hover:bg-accent-soft/40"
              >
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
            {all.length === 0 ? (
              <p className="px-1.5 py-1 text-xs text-ink-faint">{emptyText}</p>
            ) : (
              shown.length === 0 && <p className="px-1.5 py-1 text-xs text-ink-faint">No matches.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
