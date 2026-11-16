// OTC's email template import sheet (2026 OTC Speedy Setup Import Sheets -
// Email Templates): reading one a client filled in, and writing templates
// out in its layout.
import Papa from "papaparse";
import type { ContactTable } from "@/lib/contactFiles";
import { withBlankLines, type EmailTemplate } from "@/lib/emailTemplates";

export const IMPORT_COLUMNS = [
  "Title ( template name )",
  "Subject",
  "Body ( message )",
  "To Roles",
  "Cc Roles",
  "Bcc Roles",
  "File Roles",
] as const;

export type ImportedTemplate = Pick<
  EmailTemplate,
  "title" | "subject" | "body" | "to" | "cc" | "bcc" | "files"
>;

const norm = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z]+/g, " ").trim();
// Roles and files are comma separated: "Buyer, Seller".
const list = (s: string | undefined) =>
  [...new Set((s ?? "").split(",").map((x) => x.trim()).filter(Boolean))];

// Reads the sheet's rows by their headings (in any order); rows without a
// title are skipped. Throws when there's no Title column.
export function readImportSheet(table: ContactTable): ImportedTemplate[] {
  const at = (name: string) => table.columns.findIndex((c) => norm(c) === name);
  const col = {
    title: at("title"),
    subject: at("subject"),
    body: at("body"),
    to: at("to roles"),
    cc: at("cc roles"),
    bcc: at("bcc roles"),
    files: at("file roles"),
  };
  if (col.title < 0) {
    throw new Error("This doesn't look like the email template import sheet (no Title column).");
  }
  const get = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "") : "");
  return table.rows
    .map((row) => ({
      title: get(row, col.title).trim(),
      subject: get(row, col.subject).trim(),
      body: withBlankLines(get(row, col.body)).trim(),
      to: list(get(row, col.to)),
      cc: list(get(row, col.cc)),
      bcc: list(get(row, col.bcc)),
      files: list(get(row, col.files)),
    }))
    .filter((t) => t.title);
}

// A merge field's name as OTC writes it: lower case, words joined by
// underscores ("Buyer's Agent First Name" -> "buyers_agent_first_name").
export const mergeName = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Writes every merge field the same way, {{merge_field}}, whether it was
// typed as {{ Merge Field }}, {merge_field}, <<merge field>> or
// <merge field>, so OTC's merge field cleanup can remap them all. OTC's own
// markers ([START_CONTACT], [BR]...) are left as they are.
export function normalizeMergeFields(text: string) {
  const field = (_: string, name: string) => {
    const n = mergeName(name);
    return n ? `{{${n}}}` : _;
  };
  return text
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, field)
    .replace(/<<\s*([^<>]+?)\s*>>/g, field)
    .replace(/(?<!\{)\{\s*([A-Za-z][\w '’-]*?)\s*\}(?!\})/g, field)
    // <words like this> (not HTML tags, which have no spaces before ">"
    // inside a name and start with a tag name).
    .replace(/<([A-Za-z][A-Za-z0-9'’]*(?:[ _][A-Za-z0-9'’]+)+)>/g, field);
}

// The merge fields in some text (after normalizing), by name, with how many
// times each appears.
export function findMergeFields(texts: string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    for (const m of normalizeMergeFields(t).matchAll(/\{\{([a-z0-9_]+)\}\}/g)) {
      counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Normalizes the merge fields in some text, then renames any of them
// ({{old}} -> {{new}}, both by their normalized names).
export function cleanMergeFields(text: string, renames: Record<string, string>) {
  return normalizeMergeFields(text).replace(/\{\{([a-z0-9_]+)\}\}/g, (whole, name: string) => {
    const next = renames[name] ? mergeName(renames[name]) : name;
    return next ? `{{${next}}}` : whole;
  });
}

// Templates in the import sheet's layout, as CSV.
export function toImportCsv(templates: ImportedTemplate[]) {
  return Papa.unparse([
    [...IMPORT_COLUMNS],
    ...templates.map((t) => [
      t.title,
      normalizeMergeFields(t.subject),
      normalizeMergeFields(withBlankLines(t.body)),
      t.to.join(", "),
      t.cc.join(", "),
      t.bcc.join(", "),
      t.files.join(", "),
    ]),
  ]);
}

export function downloadCsv(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
