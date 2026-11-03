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

// Templates in the import sheet's layout, as CSV.
export function toImportCsv(templates: ImportedTemplate[]) {
  return Papa.unparse([
    [...IMPORT_COLUMNS],
    ...templates.map((t) => [
      t.title,
      t.subject,
      withBlankLines(t.body),
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
