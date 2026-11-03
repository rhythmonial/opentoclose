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

export const fromSample = (s: SampleEmailTemplate): EmailTemplate => ({
  id: null,
  sampleKey: s.key,
  include: s.include,
  title: s.title,
  subject: s.subject,
  body: s.body,
  to: s.to,
  cc: s.cc,
  bcc: s.bcc,
  files: [],
});

export const sampleFor = (key: string | null) =>
  key ? SAMPLE_EMAIL_TEMPLATES.find((s) => s.key === key) : undefined;

// Whether a client's copy differs from its sample (besides being used).
export function isEdited(t: EmailTemplate) {
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
    t.files.length === 0
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
