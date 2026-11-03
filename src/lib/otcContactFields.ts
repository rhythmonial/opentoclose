// OTC's contact import columns (2026 OTC Speedy Setup Import Sheets -
// Contacts), in their order, and matching a client's own column headings
// to them.

export const OTC_CONTACT_FIELDS = [
  "First Name",
  "Middle Name",
  "Last Name",
  "Email",
  "Agent License Number",
  "Cell Phone",
  "Cell Phone Extension",
  "Phone",
  "Phone Extension",
  "Address",
  "Unit Number",
  "City",
  "State",
  "Zip",
  "County",
  "Country",
  "Fax",
  "Notes",
  "Birthday",
  "Anniversary",
  "Business Name",
  "Business Email",
  "Business Fax",
  "Business License Number",
  "Business Cell Phone",
  "Business Cell Phone Extension",
  "Business Phone",
  "Business Phone Extension",
  "Business Address",
  "Business Unit Number",
  "Business City",
  "Business State",
  "Business Zip",
  "Business County",
  "Business Country",
  "Contact Role",
  "Tags",
] as const;

// A column holding whole names ("Jane Q. Smith"), split into First and Last
// Name when the contacts are imported.
export const FULL_NAME = "__full_name";
export const FULL_NAME_LABEL = "Full name (split into First and Last Name)";

export type ContactMapping = Record<string, string | null>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Other names the same column often goes by in Google, Outlook, iPhone and
// CRM exports.
const ALIASES: Record<string, string[]> = {
  "First Name": ["first", "given name", "firstname", "fname"],
  "Middle Name": ["middle", "additional name", "middle initial"],
  "Last Name": ["last", "surname", "family name", "lastname", "lname"],
  Email: ["email address", "e-mail", "e-mail address", "email 1", "e-mail 1 - value", "primary email", "personal email", "home email"],
  "Agent License Number": ["license", "license number", "license #", "agent license", "real estate license"],
  "Cell Phone": ["mobile", "mobile phone", "cell", "cellphone", "phone 1 - value", "mobile number", "cell number"],
  Phone: ["home phone", "telephone", "phone number", "primary phone", "other phone", "phone 2 - value"],
  Address: ["street", "street address", "address 1", "address line 1", "home street", "home address", "mailing address"],
  "Unit Number": ["unit", "apt", "suite", "address 2", "address line 2", "home street 2"],
  City: ["home city", "town"],
  State: ["home state", "province", "region", "state/province"],
  Zip: ["zip code", "postal code", "zipcode", "home postal code", "postcode"],
  Country: ["home country", "country/region"],
  Fax: ["home fax", "fax number"],
  Notes: ["note", "comments", "description"],
  Birthday: ["birth date", "date of birth", "dob", "bday"],
  Anniversary: ["anniversary date", "wedding anniversary"],
  "Business Name": ["company", "company name", "organization", "organization name", "organization 1 - name", "brokerage", "business"],
  "Business Email": ["work email", "business email address", "e-mail 2 address", "office email"],
  "Business Fax": ["work fax", "office fax"],
  "Business License Number": ["company license", "brokerage license", "office license"],
  "Business Phone": ["work phone", "office phone", "company phone", "business phone number"],
  "Business Address": ["work address", "business street", "company address", "office address", "work street"],
  "Business City": ["work city", "company city", "office city"],
  "Business State": ["work state", "company state", "office state"],
  "Business Zip": ["work zip", "business postal code", "work postal code", "office zip"],
  "Business Country": ["work country", "business country/region"],
  "Contact Role": ["role", "contact type", "type", "category", "job title", "title"],
  Tags: ["tag", "labels", "groups", "group membership"],
};

const LOOKUP = new Map<string, string>();
for (const field of OTC_CONTACT_FIELDS) {
  LOOKUP.set(norm(field), field);
  for (const alias of ALIASES[field] ?? []) LOOKUP.set(norm(alias), field);
}
const FULL_NAME_ALIASES = new Set(["name", "fullname", "contactname", "displayname", "contact"].map(norm));

// Suggests a match for each of the client's columns; each OTC field is used
// by at most one column (the first that matches). A whole-name column is
// only suggested when there are no first or last name columns.
export function suggestMapping(columns: string[]): ContactMapping {
  const used = new Set<string>();
  const out: ContactMapping = {};
  for (const col of columns) {
    let field: string | null = LOOKUP.get(norm(col)) ?? null;
    if (field && used.has(field)) field = null;
    if (field) used.add(field);
    out[col] = field;
  }
  if (!used.has("First Name") && !used.has("Last Name")) {
    const full = columns.find((c) => !out[c] && FULL_NAME_ALIASES.has(norm(c)));
    if (full) out[full] = FULL_NAME;
  }
  return out;
}

export const isTarget = (v: unknown): v is string =>
  typeof v === "string" &&
  (v === FULL_NAME || (OTC_CONTACT_FIELDS as readonly string[]).includes(v));

// Turns the client's rows into OTC's import layout (header row first), using
// their matches. A full name splits at its last space, filling only the
// first and last names no other column filled.
export function toOtcRows(columns: string[], rows: string[][], mapping: ContactMapping) {
  const index = new Map(OTC_CONTACT_FIELDS.map((f, i) => [f as string, i] as const));
  const out: string[][] = [[...OTC_CONTACT_FIELDS]];
  for (const row of rows) {
    const line = OTC_CONTACT_FIELDS.map(() => "");
    // Whole-name columns go last.
    const order = columns
      .map((col, c) => [col, c] as const)
      .sort(([a], [b]) => Number(mapping[a] === FULL_NAME) - Number(mapping[b] === FULL_NAME));
    order.forEach(([col, c]) => {
      const target = mapping[col];
      const value = (row[c] ?? "").trim();
      if (!target || !value) return;
      if (target === FULL_NAME) {
        const parts = value.split(/\s+/);
        const last = parts.length > 1 ? parts.pop()! : "";
        line[index.get("First Name")!] ||= parts.join(" ");
        line[index.get("Last Name")!] ||= last;
        return;
      }
      const i = index.get(target);
      if (i !== undefined) line[i] = line[i] ? `${line[i]}; ${value}` : value;
    });
    if (line.some(Boolean)) out.push(line);
  }
  return out;
}
