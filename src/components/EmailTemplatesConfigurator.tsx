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
import { readContactFile } from "@/lib/contactFiles";
import { downloadCsv, readImportSheet, toImportCsv } from "@/lib/emailImportSheet";

type Item = EmailTemplate & { key: string };

const inputClass =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// Sample Email Templates: the sample templates (and any of the client's
// own), shown as finished emails. Each can be used or not, and edited:
// title, subject, body, who it goes to (To / Cc / Bcc, from the contact
// roles) and the documents attached (from their documents).
export function EmailTemplatesConfigurator({
  accountId,
  initial,
  roleOptions,
  fileOptions,
  defaultFiles,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
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

  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Adds the templates from a filled-in import sheet, at the top.
  async function importFile(file: File) {
    setImporting(true);
    setNotice(null);
    try {
      const rows = readImportSheet(await readContactFile(file, file.name));
      const result = await importEmailTemplates(accountId, rows);
      if (!result.ok || !result.templates) throw new Error(result.error ?? "Couldn't import that file.");
      const added = result.templates.map((t) => ({ ...t, key: t.id ?? crypto.randomUUID() }));
      setItems((all) => [...added, ...all]);
      setNotice(`Imported ${added.length} template${added.length === 1 ? "" : "s"}.`);
      setQuery("");
      setSide("all");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't import that file.");
    } finally {
      setImporting(false);
    }
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
            <label
              className={`cursor-pointer rounded-lg border border-border px-4 py-1.5 text-sm font-semibold text-accent hover:border-accent ${
                importing ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {importing ? "Importing…" : "Import templates"}
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void importFile(file);
                }}
              />
            </label>
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
          <span className="text-ink-faint">
            Have your own templates? Fill in OTC&rsquo;s import sheet and import it.
          </span>
          <button
            type="button"
            onClick={() => downloadCsv(toImportCsv([]), "Email Templates import sheet.csv")}
            className="font-semibold text-accent"
          >
            Download the blank import sheet
          </button>
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
          {notice && <span className="font-semibold text-ink">{notice}</span>}
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

      <ul className="flex flex-col gap-2">
        {shown.map((t) => {
          const open = openKey === t.key;
          const editing = editingKey === t.key;
          const edited = isEdited(t, filesFor(t));
          const s = sideOf(t.title);
          return (
            <li
              key={t.key}
              className={`rounded-xl border bg-surface transition-colors ${
                t.include ? "border-border" : "border-border/60 bg-surface/60"
              }`}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={t.include}
                  onChange={(e) => update(t.key, { include: e.target.checked })}
                  aria-label={`Use ${t.title}`}
                  title="Use this template"
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => {
                    setOpenKey(open ? null : t.key);
                    if (open) setEditingKey(null);
                  }}
                  aria-expanded={open}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${t.include ? "text-ink" : "text-ink-faint"}`}>
                      {t.title}
                    </span>
                    {s !== "other" && (
                      <span className="rounded bg-accent-soft/60 px-1.5 py-px text-[10px] font-bold uppercase text-accent">
                        {SIDE_LABELS[s]}
                      </span>
                    )}
                    {!t.sampleKey && (
                      <span className="rounded bg-gold/20 px-1.5 py-px text-[10px] font-bold uppercase text-ink">
                        Yours
                      </span>
                    )}
                    {edited && (
                      <span className="rounded bg-gold/20 px-1.5 py-px text-[10px] font-bold uppercase text-ink">
                        Edited
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-soft">
                    <Inline text={t.subject || "(no subject)"} />
                  </span>
                  {(t.to.length > 0 || t.cc.length > 0) && (
                    <span className="mt-1 block text-xs text-ink-faint">
                      {t.to.length > 0 && <>To: {t.to.join(", ")}</>}
                      {t.to.length > 0 && t.cc.length > 0 && " · "}
                      {t.cc.length > 0 && <>Cc: {t.cc.join(", ")}</>}
                    </span>
                  )}
                </button>
                <span aria-hidden className={`mt-1 text-ink-faint transition-transform ${open ? "rotate-90" : ""}`}>
                  &rsaquo;
                </span>
              </div>

              {open && (
                <div className="border-t border-border px-4 pb-4 pt-3">
                  {editing ? (
                    <TemplateEditor
                      template={t}
                      roleOptions={roleOptions}
                      fileOptions={fileOptions}
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
              )}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-faint">
          No templates match.
        </p>
      )}
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

function EmailPreview({ template: t }: { template: EmailTemplate }) {
  const row = (label: string, values: string[]) =>
    values.length === 0 ? null : (
      <div className="flex gap-2">
        <span className="w-12 shrink-0 text-ink-faint">{label}</span>
        <span className="flex flex-wrap gap-1">
          {values.map((v) => (
            <span key={v} className="rounded-full border border-border bg-bg px-2 py-px text-xs text-ink">
              {v}
            </span>
          ))}
        </span>
      </div>
    );
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex flex-col gap-1.5 border-b border-border bg-bg/60 px-4 py-3 text-sm">
        {row("To", t.to)}
        {row("Cc", t.cc)}
        {row("Bcc", t.bcc)}
        {row("Attach", t.files)}
        {t.to.length + t.cc.length + t.bcc.length === 0 && (
          <span className="text-xs text-ink-faint">No recipients chosen yet.</span>
        )}
        <p className="pt-1 font-semibold text-ink">
          <Inline text={t.subject || "(no subject)"} />
        </p>
      </div>
      <div className="px-4 py-4">
        <Body body={t.body} />
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  roleOptions,
  fileOptions,
  onSave,
  onCancel,
}: {
  template: EmailTemplate;
  roleOptions: string[];
  fileOptions: string[];
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
        await onSave({ ...draft, body: withBlankLines(draft.body) });
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MultiSelect label="To" options={roleOptions} value={draft.to} onChange={(to) => set({ to })} />
        <MultiSelect label="Cc" options={roleOptions} value={draft.cc} onChange={(cc) => set({ cc })} />
        <MultiSelect label="Bcc" options={roleOptions} value={draft.bcc} onChange={(bcc) => set({ bcc })} />
        <MultiSelect
          label="Attach documents"
          options={fileOptions}
          value={draft.files}
          onChange={(files) => set({ files })}
          emptyText="No documents yet. Add them in Categorize Your Documents."
        />
      </div>
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
