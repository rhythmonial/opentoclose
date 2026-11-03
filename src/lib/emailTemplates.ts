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
};

export const BREAK = "ADDABREAK";

// Copy roles: who else gets every email a role gets (OTC Settings > Contact
// Roles). Only offered as email recipients, not as contact fields.
export const EMAIL_COPY_ROLES = ["Attorney", "Buyer", "Buyer Agent", "Escrow", "Lender", "Listing Agent", "Seller"].flatMap(
  (who) => [`CC on ALL ${who} Emails`, `BCC on ALL ${who} Emails`],
);

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
