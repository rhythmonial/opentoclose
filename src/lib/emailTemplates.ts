import { SAMPLE_EMAIL_TEMPLATES, type SampleEmailTemplate } from "@/lib/sampleEmailTemplates";

// An email template as the client sees it: a sample (as is, or their copy
// of it) or one of their own.
export type EmailTemplate = {
  // The saved row, once there is one.
  id: string | null;
  sampleKey: string | null;
  include: boolean;
  title: string;
  subject: string;
  body: string;
  to: string[];
  cc: string[];
  bcc: string[];
  files: string[];
  // The tabs it shows on in Prep Your Messages; empty or missing means the
  // one its title's prefix says (B, S, L, or other).
  sides?: TemplateSide[];
};

// The sample sheet marked paragraph breaks with ADDABREAK lines, because
// blank lines seemed to get lost on the way into OTC. OTC's import keeps
// real blank lines, so templates use those; any ADDABREAK line (in old
// copies or imported sheets) becomes one.
export const BREAK = "ADDABREAK";

export function withBlankLines(body: string) {
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line.trim() === BREAK ? "" : line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

// Everyone an email can go to (To / Cc / Bcc), exactly as OTC names its
// contact roles and in OTC's order, with each "CC / BCC on ALL ... Emails"
// copy role beside the role it copies.
export const EMAIL_RECIPIENT_ROLES = [
  "Appraiser",
  "Attorney",
  "CC on ALL Attorney Emails",
  "BCC on ALL Attorney Emails",
  "Buyer",
  "CC on ALL Buyer Emails",
  "BCC on ALL Buyer Emails",
  "Buyer's Agent Transaction Coordinator",
  "Buyer's Agent",
  "Buyer's Co Agent",
  "CC on ALL Buyer Agent Emails",
  "BCC on ALL Buyer Agent Emails",
  "Cleaning Company",
  "Escrow Officer",
  "Escrow Officer Assistant",
  "CC on ALL Escrow Emails",
  "BCC on ALL Escrow Emails",
  "Handyman",
  "HOA Contact",
  "Home Inspector",
  "Home Inspector Recommended by Agent",
  "Home Protection Plan Representative",
  "Homeowners Insurance Agent Recommended by Agent",
  "Home Protection Plan Company",
  "Home Protection Plan Company Recommended by Agent",
  "Landlord",
  "Lender",
  "Lender Assistant",
  "Lender Processor",
  "CC on ALL Lender Emails",
  "BCC on ALL Lender Emails",
  "Listing Agent Transaction Coordinator",
  "Listing Agent",
  "Listing Co Agent",
  "CC on ALL Listing Agent Emails",
  "BCC on ALL Listing Agent Emails",
  "Photographer",
  "Referral Agent",
  "Referral Company",
  "Seller",
  "CC on ALL Seller Emails",
  "BCC on ALL Seller Emails",
  "Septic Inspector",
  "Septic Inspector Recommended by Agent",
  "Sign Installation Company",
  "Stager",
  "Tenant",
  "Termite Inspector",
  "Termite Inspector Recommended by Agent",
  "Title Officer",
  "Title Officer Assistant",
  "Utility Concierge Company",
  "Well Inspector",
  "Well Inspector Recommended by Agent",
  "Videographer",
];

// Copy roles: who else gets every email a role gets (OTC Settings > Contact
// Roles). Only offered as email recipients, not as contact fields.
export const EMAIL_COPY_ROLES = EMAIL_RECIPIENT_ROLES.filter((r) => /^B?CC on ALL /.test(r));

// Best-guess attachments for a sample, from the client's own documents
// (Categorize Your Documents): the ones in the categories the email is
// about, on its side.
const ATTACH_RULES: [RegExp, string[]][] = [
  [/\bintro\b|new contract/i, ["residential", "land"]],
  [/apprais|\bAP\b/i, ["appraisal"]],
  [/septic/i, ["septic"]],
  [/termite/i, ["termite"]],
  [/home warranty/i, ["home_warranty"]],
  [/\bHOA\b/i, ["hoa"]],
  [/cancel/i, ["cancellation"]],
  [/referral/i, ["referral"]],
  [/\bLBP\b|lead.based/i, ["lbp"]],
  [/commission|\bCI\b|\bDA\b/i, ["brokerage"]],
];

export type AttachableDoc = { name: string; categories: string[]; sides: string[] };

export function guessAttachments(title: string, docs: AttachableDoc[]): string[] {
  const categories = new Set(ATTACH_RULES.filter(([re]) => re.test(title)).flatMap(([, c]) => c));
  if (categories.size === 0) return [];
  const side = sideOf(title);
  return [
    ...new Set(
      docs
        .filter(
          (d) =>
            d.categories.some((c) => categories.has(c)) &&
            (side === "other" || d.sides.length === 0 || d.sides.includes(side)),
        )
        .map((d) => d.name),
    ),
  ];
}

export const fromSample = (s: SampleEmailTemplate, files: string[] = []): EmailTemplate => ({
  id: null,
  sampleKey: s.key,
  include: s.include,
  title: s.title,
  subject: s.subject,
  body: s.body,
  to: s.to,
  cc: s.cc,
  bcc: s.bcc,
  files,
});

export const sampleFor = (key: string | null) =>
  key ? SAMPLE_EMAIL_TEMPLATES.find((s) => s.key === key) : undefined;

// Whether a client's copy differs from its sample (besides being used),
// given the attachments the sample starts with for them.
export function isEdited(t: EmailTemplate, defaultFiles: string[] = []) {
  const s = sampleFor(t.sampleKey);
  if (!s) return false;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return !(
    t.title === s.title &&
    t.subject === s.subject &&
    t.body === s.body &&
    same(t.to, s.to) &&
    same(t.cc, s.cc) &&
    same(t.bcc, s.bcc) &&
    same(t.files, defaultFiles)
  );
}

// Which side a template is for, from its title ("B ...", "S ...", "L ...").
export type TemplateSide = "buyer" | "seller" | "listing" | "other";
export function sideOf(title: string): TemplateSide {
  const t = title.trim();
  if (/^B\s/.test(t)) return "buyer";
  if (/^S\s/.test(t)) return "seller";
  if (/^L\s/.test(t)) return "listing";
  return "other";
}

export const SIDE_LABELS: Record<TemplateSide, string> = {
  buyer: "Buyer",
  seller: "Seller",
  listing: "Listing",
  other: "Other",
};

export const TEMPLATE_SIDES: TemplateSide[] = ["buyer", "seller", "listing", "other"];

// The tabs a template shows on.
export function sidesOf(t: Pick<EmailTemplate, "title" | "sides">): TemplateSide[] {
  const picked = (t.sides ?? []).filter((s) => TEMPLATE_SIDES.includes(s));
  return picked.length > 0 ? picked : [sideOf(t.title)];
}
