// Field Order: the fields filled in on a client's contract, matched to the
// fields they already have in Open to Close. The recommended order follows
// the contract; contract fields with no match need a field added, and their
// fields that aren't on the contract go below (or get archived).

// A contract field line, as the scanner writes it: "Label: value (line 12)".
export type ContractLine = { raw: string; label: string; value: string; where: string };

export function parseContractLine(raw: string): ContractLine {
  const m = raw.match(/^(.*?):\s+(.*?)\s*\(((?:line|page) [^)]+)\)$/i);
  if (m) return { raw, label: m[1].trim(), value: m[2].trim(), where: m[3] };
  const w = raw.match(/^(.*?)\s*\(((?:line|page) [^)]+)\)$/i);
  if (w) return { raw, label: w[1].replace(/:$/, "").trim(), value: "", where: w[2] };
  return { raw, label: raw.replace(/:$/, "").trim(), value: "", where: "" };
}

export const splitLines = (text: string) => {
  const seen = new Set<string>();
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((l) => {
      const k = l.toLowerCase();
      if (!l || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
};

const STOP = new Set(["the", "of", "a", "an", "to", "for", "on", "in", "by", "and", "or", "if", "any", "is", "s", "contract", "agreement", "total"]);
// Words that mean the same thing on a contract and in OTC.
const SAME: Record<string, string> = {
  sale: "purchase",
  sales: "purchase",
  selling: "purchase",
  purchaser: "buyer",
  vendor: "seller",
  closing: "close",
  closed: "close",
  settlement: "close",
  coe: "close",
  emd: "deposit",
  earnest: "deposit",
  escrow: "deposit",
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
  property: "address",
  phone: "phone",
  telephone: "phone",
  cell: "phone",
  mail: "email",
};

function tokens(s: string) {
  return new Set(
    s
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/e-mail/g, "email")
      .replace(/#/g, " number ")
      .split(/[^a-z0-9]+/)
      .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t))
      .map((t) => SAME[t] ?? t)
      .filter((t) => t && !STOP.has(t)),
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

export type FieldOrderRow = { line: ContractLine; field: string | null; suggested: boolean };
export type FieldOrderPlan = { rows: FieldOrderRow[]; fields: string[]; notOnContract: string[] };

// What's been picked for each contract line: a field name, or "" for "no
// matching field". Lines not in here get the best-named match.
export function parseMap(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json || "{}");
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

export function fieldOrderPlan(contractText: string, currentText: string, mapJson: string): FieldOrderPlan {
  const fields = splitLines(currentText);
  const picked = parseMap(mapJson);
  const used = new Set(Object.values(picked).filter((f) => f && fields.includes(f)));
  const rows = splitLines(contractText).map((raw) => {
    const line = parseContractLine(raw);
    if (raw in picked) {
      const f = picked[raw];
      return { line, field: f && fields.includes(f) ? f : null, suggested: false };
    }
    let best: string | null = null;
    let bestScore = 0.5;
    for (const f of fields) {
      // A field not matched yet wins a tie.
      const s = nameScore(line.label, f) + (used.has(f) ? 0 : 0.01);
      if (s > bestScore) {
        best = f;
        bestScore = s;
      }
    }
    if (best) used.add(best);
    return { line, field: best, suggested: best !== null };
  });
  const matched = new Set(rows.map((r) => r.field).filter(Boolean));
  return { rows, fields, notOnContract: fields.filter((f) => !matched.has(f)) };
}

// The report's list: their fields in contract order (each once), and the
// contract fields that need one added, where they fall.
export function fieldOrderList(plan: FieldOrderPlan) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { line, field } of plan.rows) {
    const where = line.where ? ` (${line.where})` : "";
    if (field) {
      if (seen.has(field)) continue;
      seen.add(field);
      out.push(`${field}${where}`);
    } else out.push(`**Add a field:** ${line.label}${where}`);
  }
  return out;
}
