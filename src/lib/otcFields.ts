import type { WorkflowFieldType } from "@/lib/workflowFields";

// The fields that come with an Open to Close account, by group and section
// as they appear in OTC's Field Editor. The type on each is our best match
// for it, used to suggest fields when a client picks a field type.
type Kind = WorkflowFieldType | "currency" | "percentage";

export type OtcSection = {
  id: string;
  group: string;
  name: string;
  fields: { name: string; kind: Kind }[];
};

export const OTC_SECTIONS: OtcSection[] = [
  {
    id: "commission-details",
    group: "Commission Details",
    name: "Commission Details",
    fields: [
      { name: "Listing Side Commission Flat Fee or Percentage", kind: "choice" },
      { name: "Buyer Side Commission Flat Fee or Percentage", kind: "choice" },
      { name: "Listing Side Commission - Flat Fee", kind: "currency" },
      { name: "Listing Side Commission - Percentage", kind: "percentage" },
      { name: "Buyer Side Commission - Percentage", kind: "percentage" },
      { name: "Buyer Side Commission - Flat Fee", kind: "currency" },
      { name: "Total Commission", kind: "currency" },
      { name: "Transaction File Fee", kind: "currency" },
      { name: "Additional Commission Notes", kind: "text_area" },
    ],
  },
  {
    id: "referral-details",
    group: "Commission Details",
    name: "Referral Details",
    fields: [
      { name: "Is there a Referral Fee", kind: "choice" },
      { name: "Referral Type", kind: "choice" },
      { name: "Referral Agent Name", kind: "text" },
      { name: "Referral Flat Fee or Percentage", kind: "choice" },
      { name: "Referral Flat Fee Amount", kind: "currency" },
      { name: "Referral Percentage Amount", kind: "percentage" },
      { name: "Referral W9 Received", kind: "date" },
    ],
  },
  ...[
    "Open House Details",
    "Showing Details",
    "New Construction Details",
    "Rental Details",
    "Radon Details",
    "Pool Details",
    "Survey Details",
  ].map((name) => ({
    id: slug(name),
    group: "Additional Fields (Not In Use)",
    name,
    fields: [],
  })),
  {
    id: "additional-fields-not-in-use",
    group: "Additional Fields (Not In Use)",
    name: "Additional Fields (Not In Use)",
    fields: [
      { name: "Inclusions", kind: "text_area" },
      { name: "Exclusions", kind: "text_area" },
      { name: "Offer Created Date", kind: "date" },
      { name: "Extension Agreement - Days", kind: "number" },
      { name: "Extension Agreement - Date", kind: "date" },
    ],
  },
  ...["Termite & Pest Details", "Solar Details"].map((name) => ({
    id: slug(name),
    group: "Additional Fields (Not In Use)",
    name,
    fields: [],
  })),
  {
    id: "well-details",
    group: "Additional Fields (Not In Use)",
    name: "Well Details",
    fields: [
      { name: "Well Onsite", kind: "choice" },
      { name: "Will There Be A Well Inspection", kind: "choice" },
      { name: "Well Inspection Date", kind: "date" },
    ],
  },
  {
    id: "septic-details",
    group: "Additional Fields (Not In Use)",
    name: "Septic Details",
    fields: [
      { name: "Septic Onsite", kind: "choice" },
      { name: "Will There Be A Septic Inspection", kind: "choice" },
      { name: "Septic Inspection Date", kind: "date" },
    ],
  },
  {
    id: "team-commission-details",
    group: "Additional Fields (Not In Use)",
    name: "Team Commission Details",
    fields: [
      { name: "Gross Commission Amount", kind: "currency" },
      { name: "Net Seller Agent Commission Amount", kind: "currency" },
      { name: "Net Buyer Agent Commission Amount", kind: "currency" },
      { name: "Showing Agent Split Percentage", kind: "percentage" },
      { name: "Showing Agent Split Total Net Amount", kind: "currency" },
      { name: "Team Split Total Net Amount", kind: "currency" },
      { name: "Team Split Percentage", kind: "percentage" },
      { name: "Commission Reduction", kind: "currency" },
    ],
  },
  {
    id: "brokerage-commission-details",
    group: "Additional Fields (Not In Use)",
    name: "Brokerage Commission Details",
    fields: [
      { name: "Brokerage Split Flat Fee Amount", kind: "currency" },
      { name: "Brokerage Split Percentage", kind: "percentage" },
      { name: "Brokerage Total Net Amount", kind: "currency" },
    ],
  },
];

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type OtcField = {
  // Built-in fields: "<section id>/<field slug>". A client's new field: an
  // id starting with NEW_OTC_PREFIX (see workflowFields).
  id: string;
  name: string;
  sectionId: string;
  kind?: Kind;
  isNew?: boolean;
};

export const OTC_FIELDS: OtcField[] = OTC_SECTIONS.flatMap((s) =>
  s.fields.map((f) => ({ id: `${s.id}/${slug(f.name)}`, name: f.name, sectionId: s.id, kind: f.kind })),
);

export const OTC_FIELD_IDS = new Set(OTC_FIELDS.map((f) => f.id));
export const OTC_SECTION_IDS = new Set(OTC_SECTIONS.map((s) => s.id));
export const sectionById = (id: string) => OTC_SECTIONS.find((s) => s.id === id);

// Whether an OTC field is the same kind as a workflow field type.
export function kindMatches(
  kind: Kind | undefined,
  type: WorkflowFieldType | undefined,
  decimalFormat?: "currency" | "percentage",
) {
  if (!kind || !type) return false;
  if (type === "decimal") return kind === decimalFormat;
  return kind === type;
}
