// Reads a contacts file in the browser into column headings and rows:
// CSV / TSV / TXT, Excel (.xlsx) and vCard (.vcf).
import Papa from "papaparse";

export type ContactTable = { columns: string[]; rows: string[][] };

export const CONTACT_FILE_ACCEPT =
  ".csv,.tsv,.txt,.xlsx,.vcf,.vcard,text/csv,text/plain,text/vcard,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const extensionOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

// The upload type for a contacts file, by extension.
export function contentTypeOf(name: string) {
  switch (extensionOf(name)) {
    case "csv":
      return "text/csv";
    case "tsv":
      return "text/tab-separated-values";
    case "txt":
      return "text/plain";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "vcf":
    case "vcard":
      return "text/vcard";
    default:
      return "application/octet-stream";
  }
}

const cell = (v: unknown) =>
  v === null || v === undefined
    ? ""
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : String(v).trim();

// The first non-empty row is the headings; blank or repeated headings get a
// name of their own ("Column 3", "Email (2)").
function toTable(raw: unknown[][]): ContactTable {
  const rows = raw.map((r) => r.map(cell)).filter((r) => r.some(Boolean));
  if (rows.length === 0) return { columns: [], rows: [] };
  const [head, ...body] = rows;
  const width = Math.max(...rows.map((r) => r.length));
  const seen = new Map<string, number>();
  const columns = Array.from({ length: width }, (_, i) => {
    const base = head[i] || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  return { columns, rows: body.map((r) => columns.map((_, i) => r[i] ?? "")) };
}

// vCards become one row each, with the details people usually keep.
function parseVcf(text: string): ContactTable {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const columns = [
    "Full Name", "First Name", "Middle Name", "Last Name", "Email", "Email 2",
    "Mobile Phone", "Home Phone", "Work Phone", "Street", "City", "State",
    "Postal Code", "Country", "Company", "Title", "Note", "Birthday", "Anniversary",
  ];
  const decode = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
  const rows = cards.map((card) => {
    const r: Record<string, string> = {};
    const emails: string[] = [];
    for (const line of card.split(/\r?\n/)) {
      const at = line.indexOf(":");
      if (at < 0) continue;
      const [prop, ...params] = line.slice(0, at).split(";");
      const name = prop.replace(/^item\d+\./i, "").toUpperCase();
      const type = params.join(";").toUpperCase();
      const value = line.slice(at + 1);
      if (name === "FN") r["Full Name"] = decode(value);
      else if (name === "N") {
        const [last, first, middle] = value.split(";").map(decode);
        Object.assign(r, { "Last Name": last ?? "", "First Name": first ?? "", "Middle Name": middle ?? "" });
      } else if (name === "EMAIL") emails.push(decode(value));
      else if (name === "TEL") {
        const key = /CELL|MOBILE|IPHONE/.test(type) ? "Mobile Phone" : /WORK/.test(type) ? "Work Phone" : "Home Phone";
        r[key] ||= decode(value);
      } else if (name === "ADR" && !r.Street) {
        const [, , street, city, state, zip, country] = value.split(";").map(decode);
        Object.assign(r, { Street: street ?? "", City: city ?? "", State: state ?? "", "Postal Code": zip ?? "", Country: country ?? "" });
      } else if (name === "ORG") r.Company = decode(value.split(";")[0]);
      else if (name === "TITLE") r.Title = decode(value);
      else if (name === "NOTE") r.Note = decode(value);
      else if (name === "BDAY") r.Birthday = decode(value);
      else if (name === "ANNIVERSARY" || name === "X-ANNIVERSARY") r.Anniversary = decode(value);
    }
    r.Email = emails[0] ?? "";
    r["Email 2"] = emails[1] ?? "";
    return columns.map((c) => r[c] ?? "");
  });
  // Leave out columns no card uses.
  const used = columns.map((_, i) => rows.some((row) => row[i]));
  return {
    columns: columns.filter((_, i) => used[i]),
    rows: rows.map((row) => row.filter((_, i) => used[i])),
  };
}

export async function readContactFile(file: Blob, name: string): Promise<ContactTable> {
  const ext = extensionOf(name);
  if (ext === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    return toTable((await readSheet(file)) as unknown[][]);
  }
  if (ext === "xls" || ext === "numbers" || ext === "ods") {
    throw new Error("Please save this file as .xlsx or .csv and upload that instead.");
  }
  const text = await file.text();
  if (ext === "vcf" || ext === "vcard" || /^\s*BEGIN:VCARD/i.test(text)) return parseVcf(text);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  return toTable(parsed.data);
}
