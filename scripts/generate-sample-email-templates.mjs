// Regenerates src/lib/sampleEmailTemplates.ts from the TC Optimize email sheet:
//   node scripts/generate-sample-email-templates.mjs <sheet.csv> src/lib/sampleEmailTemplates.ts
//   npx prettier --write src/lib/sampleEmailTemplates.ts
import Papa from "papaparse";
import fs from "node:fs";
const [csv, outFile] = process.argv.slice(2);
const r = Papa.parse(fs.readFileSync(csv, "utf8"), { skipEmptyLines: "greedy" }).data.slice(2);
const BA = "Buyer's Agent", LA = "Listing Agent", TO = "Title Officer";
const ROLE = { "Buyers Agent": BA, "Sellers Agent": LA, "Title Company": TO, Lender: "Lender", Buyer: "Buyer", Seller: "Seller", Attorney: "Attorney", "Escrow Officer": "Escrow Officer" };
const roles = (s) => [...new Set((s || "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => ROLE[x]).filter(Boolean))];
const GUESS = {
  l_appointment_confirmation: [["Seller"], [LA]], l_intro_to_seller: [["Seller"], [LA]],
  s_request_sign_down: [[LA], []], s_closing_in_3d_key_exchange_w_s: [["Seller"], [LA]],
  b_claims_history_due_today: [[LA], [BA]], s_claims_history_due_today: [["Seller"], [LA]],
  b_request_ci_to_title: [[TO], [BA]], b_claims_history_due_in_1_day: [[LA], [BA]],
  b_spds_to_coop: [[LA], [BA]], s_claims_history_due_in_1_day: [["Seller"], [LA]],
  s_spds_due_in_1_day: [[LA], []], b_review_request: [["Buyer"], [BA]],
  b_pre_closing_wt_to_all_parties: [["Buyer", LA, TO], [BA]],
  s_closing_in_1w_to_coop_title_w_letter_to_title_all_docs_email: [[BA, "Escrow Officer", TO], [LA]],
  s_final_doc_request_email: [[BA, TO], [LA]], b_final_doc_request_email: [[LA, TO], [BA]],
  s_claims_history_waiver_past_due: [[LA], []], b_da_for_approval: [[BA], []], s_da_for_approval: [[LA], []],
  s_da_revision_for_approval: [[LA], []], b_spds_due_in_1_day: [[LA], [BA]],
  s_order_sign_down: [["Sign Installation Company"], [LA]], b_claims_history_to_buyer: [["Buyer"], [BA]],
  s_spds_waiver_trustee: [[LA], []], b_seller_s_contact_info: [[BA], []],
};
const COPY = { Buyer: "CC on ALL Buyer Emails", Seller: "CC on ALL Seller Emails", [BA]: "CC on ALL Buyer Agent Emails", [LA]: "CC on ALL Listing Agent Emails", Lender: "CC on ALL Lender Emails", Attorney: "CC on ALL Attorney Emails", "Escrow Officer": "CC on ALL Escrow Emails" };
// Emails to one side's client leave out both agents (we're one of them; the
// other is the co-op) and their copy roles.
const AGENTS = new Set([BA, LA, COPY[BA], COPY[LA]]);
const seen = new Set(), keys = new Map(), out = [];
let clientEmails = 0;
for (const row of r) {
  const sig = JSON.stringify(row); if (seen.has(sig)) continue; seen.add(sig);
  const title = row[2].trim(); if (!title) continue;
  const base = title.toLowerCase().replace(/\(tco\)/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const n = (keys.get(base) || 0) + 1; keys.set(base, n); const key = n > 1 ? base + "_" + n : base;
  let to = roles(row[7]), cc = roles(row[8]), bcc = roles(row[9]);
  if (to.length === 0 && cc.length === 0 && GUESS[key]) [to, cc] = GUESS[key];
  // Copy roles go with their role: on To for To, on Cc for Cc.
  const copies = (list) => list.map((x) => COPY[x]).filter(Boolean);
  to = [...new Set([...to, ...copies(to)])];
  cc = [...new Set([...cc, ...copies(cc)])].filter((x) => !to.includes(x));
  const toClient = to.includes("Buyer") !== to.includes("Seller");
  if (toClient) {
    clientEmails++;
    [to, cc, bcc] = [to, cc, bcc].map((list) => list.filter((x) => !AGENTS.has(x)));
  }
  const body = row[5].replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
  out.push({ key, title, subject: row[4].trim(), body, include: false, to, cc, bcc });
}
console.error("templates", out.length, "| client emails", clientEmails, "| no To:", out.filter((o) => !o.to.length).map((o) => o.key).join(", "));
fs.writeFileSync(outFile, `// Sample email templates for the Sample Email Templates lesson, from "OTC MV
// Emails & Texts Sheet by 2023 TC Optimize - Email Templates". All start
// unchecked. Roles use OTC's contact role names (Buyers Agent -> Buyer's
// Agent, Sellers Agent -> Listing Agent, Title Company -> Title Officer).
// Where the sheet has no recipients they're a best guess from the email's
// title and wording; everyone an email goes to also gets their "CC on ALL
// ... Emails" role beside them (on To for To, on Cc for Cc); and an email
// to one side's client leaves out both agents (we're one of them, the
// other is the co-op). ADDABREAK lines mark
// where a blank line goes during setup. Generated from the sheet; edit the
// sheet and regenerate rather than by hand.

export type SampleEmailTemplate = {
  key: string;
  title: string;
  subject: string;
  body: string;
  include: boolean;
  to: string[];
  cc: string[];
  bcc: string[];
};

export const SAMPLE_EMAIL_TEMPLATES: SampleEmailTemplate[] = ${JSON.stringify(out, null, 2)};
`);
