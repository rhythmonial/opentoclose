// Field Order: the fields on a client's contract (names, in contract order)
// matched to the field sections and fields they already have in Open to
// Close. The recommended order follows the contract; contract fields with
// no match need a field added, and their fields that aren't on the
// contract go below (or get archived).

// A contract field line: a name, or "Unlabeled field (line 12)".
export type ContractLine = { raw: string; label: string; where: string };

export function parseContractLine(raw: string): ContractLine {
  const w = raw.match(/^(.*?)\s*\(((?:line|page) [^)]+)\)$/i);
  if (w) return { raw, label: w[1].replace(/:.*$/, "").trim(), where: w[2] };
  return { raw, label: raw.replace(/:.*$/, "").trim(), where: "" };
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);

export const contractLines = (text: string) => {
  const seen = new Set<string>();
  return lines(text).filter((l) => !seen.has(l.toLowerCase()) && !!seen.add(l.toLowerCase()));
};

export type OtcField = { key: string; name: string; section: string; hidden: boolean };

// What's copied from a field group's page in Open to Close: the group's
// name, then each section as "All | None Add Field | Edit" and the
// section's name, then its fields ("Hidden" after a hidden one's name).
// Pasted without those, every line is a field.
export function parseOtcFields(text: string): OtcField[] {
  const all = lines(text);
  const marker = (l: string) => /^all\s*\|\s*none\b/i.test(l);
  const hasSections = all.some(marker);
  const out: OtcField[] = [];
  const seen = new Set<string>();
  let section = "";
  let started = !hasSections;
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    if (marker(l)) {
      section = all[i + 1] ?? "";
      started = true;
      i++;
      continue;
    }
    // Before the first section: the group's name.
    if (!started || /^(add field|edit|all|none)$/i.test(l)) continue;
    const hidden = /\s+hidden$/i.test(l);
    const name = l.replace(/\s+hidden$/i, "").trim();
    const key = section ? `${section} › ${name}` : name;
    if (!name || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push({ key, name, section, hidden });
  }
  return out;
}

const STOP = new Set(["the", "of", "a", "an", "to", "for", "on", "in", "by", "and", "or", "if", "any", "is", "s", "contract", "agreement", "total", "there", "are", "removal"]);
// Phrases and words that mean the same thing on a contract and in OTC.
const PHRASES: [RegExp, string][] = [
  [/close of escrow|closing of escrow|\bcoe\b/g, "closing"],
  [/earnest money|\bemd\b/g, "deposit"],
  [/e-mail/g, "email"],
  [/#/g, " number "],
  [/&/g, " and "],
];
const SAME: Record<string, string> = {
  sale: "purchase",
  sales: "purchase",
  selling: "purchase",
  price: "amount",
  purchaser: "buyer",
  vendor: "seller",
  closing: "close",
  closed: "close",
  settlement: "close",
  earnest: "deposit",
  // OTC calls a contingency removal a "CR".
  contingency: "cr",
  contingencie: "cr",
  inspection: "inspect",
  financing: "loan",
  finance: "loan",
  mortgage: "loan",
  lender: "loan",
  acceptance: "effective",
  binding: "effective",
  executed: "effective",
  execution: "effective",
  no: "number",
  num: "number",
  amt: "amount",
  addr: "address",
  street: "address",
  telephone: "phone",
  cell: "phone",
  mail: "email",
};

function tokens(s: string) {
  let t = s.toLowerCase();
  for (const [re, to] of PHRASES) t = t.replace(re, ` ${to} `);
  return new Set(
    t
      .split(/[^a-z0-9]+/)
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
      .map((w) => SAME[w] ?? w)
      .filter((w) => w && !STOP.has(w)),
  );
}

// 0 (nothing alike) to 1 (the same words).
export function nameScore(a: string, b: string) {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let both = 0;
  for (const t of A) if (B.has(t)) both++;
  return (2 * both) / (A.size + B.size);
}

export type FieldOrderRow = { line: ContractLine; field: OtcField | null; suggested: boolean };
export type FieldOrderPlan = { rows: FieldOrderRow[]; fields: OtcField[]; notOnContract: OtcField[] };

// What's been picked for each contract field: one of theirs (its key), or
// "" for "no match". Contract fields not in here get the best-named match.
export function parseMap(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json || "{}");
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

export function fieldOrderPlan(contractText: string, otcText: string, mapJson: string): FieldOrderPlan {
  const fields = parseOtcFields(otcText);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const picked = parseMap(mapJson);
  const used = new Set(Object.values(picked).filter((k) => byKey.has(k)));
  const rows = contractLines(contractText).map((raw) => {
    const line = parseContractLine(raw);
    if (raw in picked) return { line, field: byKey.get(picked[raw]) ?? null, suggested: false };
    let best: OtcField | null = null;
    // A one-word name ("Buyer") only matches a field of the same name.
    let bestScore = tokens(line.label).size === 1 ? 0.99 : 0.59;
    for (const f of fields) {
      // The same name wins a tie, then a field that isn't matched yet, then
      // one that isn't hidden.
      const same = f.name.toLowerCase() === line.label.toLowerCase() ? 0.05 : 0;
      const s = nameScore(line.label, f.name) + same + (used.has(f.key) ? 0 : 0.02) + (f.hidden ? 0 : 0.01);
      if (s > bestScore) {
        best = f;
        bestScore = s;
      }
    }
    if (best) used.add(best.key);
    return { line, field: best, suggested: best !== null };
  });
  const matched = new Set(rows.map((r) => r.field?.key));
  return { rows, fields, notOnContract: fields.filter((f) => !matched.has(f.key) && !f.hidden) };
}

// The report's list: their fields in contract order (each once, with its
// section), and the contract fields that need one added, where they fall.
export function fieldOrderList(plan: FieldOrderPlan) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { line, field } of plan.rows) {
    if (field) {
      if (seen.has(field.key)) continue;
      seen.add(field.key);
      out.push(field.section ? `${field.name} *(${field.section})*` : field.name);
    } else out.push(`**Add a field:** ${line.label}`);
  }
  return out;
}
