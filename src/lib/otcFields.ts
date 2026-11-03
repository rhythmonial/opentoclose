import type { WorkflowFieldType } from "@/lib/workflowFields";

// The fields that come with an Open to Close account, by group and section
// as they appear in OTC's Field Editor, with their types (used to suggest
// fields when a client picks a field type). "currency" is OTC's Decimal
// Dollar type.
type Kind = WorkflowFieldType | "currency" | "percentage";

export type OtcSection = {
  id: string;
  group: string;
  name: string;
  fields: { name: string; kind: Kind }[];
};

// Contact fields are filled by a contact in one of these roles (OTC's
// Settings > Contact Roles), not by a field in the Field Editor.
export const CONTACT_ROLES_SECTION = "contact-roles";

// Names cut off in OTC's settings list are filled in with our best guess
// and marked "(confirm)" in a comment.
const CONTACT_ROLES = [
  "Appraiser",
  "Attorney",
  "CC on ALL Attorney Emails",
  "BCC on ALL Attorney Emails",
  "Buyer",
  "CC on ALL Buyer Emails",
  "BCC on ALL Buyer Emails",
  "Buyer's Agent Transaction Coordinator", // (confirm)
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
  "Home Inspector Recommended", // (confirm)
  "Home Protection Plan", // (confirm)
  "Homeowners Insurance", // (confirm)
  "Home Protection Plan Company", // (confirm)
  "Home Protection Plan Representative", // (confirm)
  "Landlord",
  "Lender",
  "Lender Assistant",
  "Lender Processor",
  "CC on ALL Lender Emails",
  "BCC on ALL Lender Emails",
  "Listing Agent Transaction Coordinator", // (confirm)
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
  "Septic Inspector Recommended", // (confirm)
  "Sign Installation Company", // (confirm)
  "Stager",
  "Tenant",
  "Termite Inspector",
  "Termite Inspector Recommended", // (confirm)
  "Title Officer",
  "Title Officer Assistant",
  "Utility Concierge Company", // (confirm)
  "Well Inspector",
  "Well Inspector Recommended", // (confirm)
  "Videographer",
];

// From OTC_FIELDS - Sheet1.csv (OTC's Field Editor: group, section, field,
// type). "Decimal Currency" there is OTC's Decimal Dollar type.
const FIELD_SECTIONS: [
  group: string,
  section: string,
  fields: [name: string, kind: Kind][],
][] = [
  [
    "Address",
    "Address",
    [
      ["Address", "text"],
      ["Unit Number", "text"],
      ["City", "text"],
      ["State", "choice"],
      ["Zip", "text"],
      ["County", "choice"],
      ["Country", "text"],
    ],
  ],
  [
    "Address",
    "Submission Details",
    [
      ["Intake Date", "date"],
      ["Submitting Agents Full Name", "text"],
      ["Last Day of the Year", "date"],
    ],
  ],
  [
    "Transaction",
    "Critical Details",
    [
      ["Contract Status", "choice"],
      ["Client Type", "choice"],
      ["Acceptance Date", "date"],
      ["Final Walkthough Date", "date"],
      ["Possession Date", "date"],
      ["Closing Date", "date"],
      ["Purchase Amount", "currency"],
      ["Are there any seller paid closing costs", "choice"],
      ["Seller Concessions", "currency"],
    ],
  ],
  [
    "Transaction",
    "Property Details",
    [
      ["Property Type", "choice"],
      ["Property Occupant Type", "choice"],
      ["Is House Built Prior to 1978", "choice"],
      ["Year Built", "number"],
      ["MLS Number", "text"],
      ["Tax ID", "text"],
      ["Legal Description", "text_area"],
    ],
  ],
  [
    "Transaction",
    "Earnest Money Details",
    [
      ["Earnest Money Amount", "currency"],
      ["Earnest Money Held By", "choice"],
      ["Earnest Money Due - Date", "date"],
      ["Earnest Money Due - Days", "number"],
      ["Earnest Money Delivery Status", "choice"],
      ["Earnest Money Receipt Date", "date"],
      ["Additional Deposit Amount Due", "date"],
      ["Additional Deposit Amount Due Receipt Date", "date"],
    ],
  ],
  [
    "Transaction",
    "Disclosures & Addendums",
    [
      ["Will Seller Disclosures Be Required", "choice"],
      ["Seller Disclosure Due - Date", "date"],
      ["Seller Disclosure Due- Days", "number"],
      ["Seller Disclosure Delivery Status", "choice"],
      ["Will a Lead-Based Paint Disclosure Be Required", "choice"],
    ],
  ],
  [
    "Transaction",
    "Inspection Details",
    [
      ["Will There Be An Inspection", "choice"],
      ["Type of Inspections", "choice"],
      ["Inspection Period - Days", "number"],
      ["Inspection Period Date", "date"],
      ["Date of Home Inspection", "date"],
      ["Buyers Response to Repairs", "choice"],
      ["Inspection Repair Receipts Delivered - Y/N", "choice"],
      ["Inspection Repair Credit Amount", "currency"],
      ["Inspection Repairs Due Date", "date"],
      ["Results of Lead-Based Paint Assessment", "choice"],
    ],
  ],
  [
    "Transaction",
    "HOA Details",
    [
      ["Is There An HOA", "choice"],
      ["HOA Due - Days", "number"],
      ["HOA Due Date", "date"],
      ["HOA Dues or Fees Amount", "currency"],
      ["HOA Dues Payment Frequency", "choice"],
      ["HOA Company Website", "text"],
    ],
  ],
  [
    "Transaction",
    "Financing Details",
    [
      ["Is There a Loan", "choice"],
      ["Loan Type", "choice"],
      ["Loan Application Due - Days", "number"],
      ["Loan Application Due Date", "date"],
      ["Loan Approval Due - Days", "number"],
      ["Loan Approval Due Date", "date"],
      ["Buyers Loan Approval Status", "choice"],
      ["CD Delivery Status", "choice"],
    ],
  ],
  [
    "Transaction",
    "Appraisal Details",
    [
      ["Will There Be An Appraisal", "choice"],
      ["Appraisal Scheduled - Y/N", "choice"],
      ["Appraisal Due - Days", "number"],
      ["Appraisal Due Date", "date"],
      ["Appraisal Appt Date", "date"],
      ["Appraisal Met Value - Y/N", "choice"],
      ["Appraisal Conditions - Y/N", "choice"],
      ["Appraisal Conditions Description", "text_area"],
      ["Appraisal Conditions Completed by Seller", "date"],
      ["Appraisal Re-inspection Scheduled - Y/N", "choice"],
      ["Appraisal Inspection Requested Date", "date"],
      ["Appraised Value", "currency"],
      ["Appraisal Cancellation", "text"],
    ],
  ],
  [
    "Transaction",
    "Home Warranty Details",
    [
      ["Home Warranty Offered", "choice"],
      ["Home Warranty - Amount", "currency"],
      ["Home Warranty is Paid By", "choice"],
      ["Home Warranty Ordered By", "choice"],
      ["Home Warranty Company", "text"],
    ],
  ],
  [
    "Transaction",
    "Closing Details",
    [
      ["Deed Released to Record", "choice"],
      ["Deed RECORDED Date", "date"],
      ["Walkthrough Waived", "choice"],
    ],
  ],
  [
    "Transaction",
    "Cancellation - Termination",
    [
      ["Termination Date", "date"],
      ["Title or Escrow Release", "date"],
    ],
  ],
  [
    "Listing Details",
    "Critical Listing Details",
    [
      ["Listing Price", "currency"],
      ["Listing Agreement Start Date", "date"],
      ["Listing Agreement Expiration Date", "date"],
      ["Will We Be Doing a Coming Soon", "choice"],
      ["Coming Soon Launch Date", "date"],
      ["Projected MLS Live Date", "date"],
      ["MLS Live Date", "date"],
    ],
  ],
  [
    "Listing Details",
    "Access Details",
    [
      ["Property Access Details", "text_area"],
      ["Is there an Alarm", "choice"],
      ["Alarm Code", "text"],
      ["Lockbox Code", "text"],
      ["Garage Code", "text"],
      ["Door Keypad Code", "text"],
      ["Important Access Notes", "text_area"],
    ],
  ],
  [
    "Listing Details",
    "Photography Details",
    [
      ["Are we scheduling photos", "choice"],
      ["What Photo Types would you like ordered", "choice"],
      ["Photography Date", "date"],
    ],
  ],
  [
    "Listing Details",
    "Sign Details",
    [
      ["Will There be a Sign Installed", "choice"],
      ["Sign Installation Type", "choice"],
      ["Sign Install Date", "date"],
    ],
  ],
  [
    "Listing Details",
    "Additional Listing Services Provided",
    [
      ["Are We Doing Staging", "choice"],
      ["Staging Date", "date"],
      ["Are We Ordering a Listing Home Protection Plan", "choice"],
      ["Cleaning Date", "date"],
    ],
  ],
  [
    "Commission Details",
    "Commission Details",
    [
      ["Listing Side Commission Flat Fee or Percentage", "choice"],
      ["Buyer Side Commission Flat Fee or Percentage", "choice"],
      ["Listing Side Commission - Flat Fee", "currency"],
      ["Listing Side Commission - Percentage", "percentage"],
      ["Buyer Side Commission - Percentage", "percentage"],
      ["Buyer Side Commission - Flat Fee", "currency"],
      ["Total Commission", "percentage"],
      ["Transaction File Fee", "currency"],
      ["Additional Commission Notes", "text_area"],
    ],
  ],
  [
    "Commission Details",
    "Referral Details",
    [
      ["Is there a Referral Fee", "choice"],
      ["Referral Type", "choice"],
      ["Referral Agent Name", "text"],
      ["Referral Flat Fee or Percentage", "choice"],
      ["Referral Flat Fee Amount", "currency"],
      ["Referral Percentage Amount", "percentage"],
      ["Referral W9 Received", "choice"],
    ],
  ],
  ["Additional Fields (Not In Use)", "Open House Details", []],
  ["Additional Fields (Not In Use)", "Showing Details", []],
  ["Additional Fields (Not In Use)", "New Construction Details", []],
  ["Additional Fields (Not In Use)", "Rental Details", []],
  ["Additional Fields (Not In Use)", "Radon Details", []],
  ["Additional Fields (Not In Use)", "Pool Details", []],
  ["Additional Fields (Not In Use)", "Survey Details", []],
  [
    "Additional Fields (Not In Use)",
    "Additional Fields (Not In Use)",
    [
      ["Inclusions", "text_area"],
      ["Exclusions", "text_area"],
      ["Offer Created Date", "date"],
      ["Extension Agreement - Days", "number"],
      ["Extension Agreement - Date", "date"],
    ],
  ],
  ["Additional Fields (Not In Use)", "Termite & Pest Details", []],
  ["Additional Fields (Not In Use)", "Solar Details", []],
  [
    "Additional Fields (Not In Use)",
    "Well Details",
    [
      ["Well Onsite", "choice"],
      ["Will There Be A Well Inspection", "choice"],
      ["Well Inspection Date", "date"],
    ],
  ],
  [
    "Additional Fields (Not In Use)",
    "Septic Details",
    [
      ["Septic Onsite", "choice"],
      ["Will There Be A Septic Inspection", "choice"],
      ["Septic Inspection Date", "date"],
    ],
  ],
  [
    "Additional Fields (Not In Use)",
    "Team Commission Details",
    [
      ["Gross Commission Amount", "currency"],
      ["Net Seller Agent Commission Amount", "currency"],
      ["Net Buyer Agent Commission Amount", "currency"],
      ["Showing Agent Split Percentage", "percentage"],
      ["Showing Agent Split Total Net Amount", "currency"],
      ["Team Split Total Net Amount", "currency"],
      ["Team Split Percentage", "percentage"],
      ["Commission Reduction", "text"],
    ],
  ],
  [
    "Additional Fields (Not In Use)",
    "Brokerage Commission Details",
    [
      ["Brokerage Split Flat Fee Amount", "currency"],
      ["Brokerage Split Percentage", "percentage"],
      ["Brokerage Total Net Amount", "currency"],
    ],
  ],
];

export const OTC_SECTIONS: OtcSection[] = [
  {
    id: CONTACT_ROLES_SECTION,
    group: "Contact Roles",
    name: "Contact Roles",
    fields: CONTACT_ROLES.map((name) => ({ name, kind: "contact" as const })),
  },
  ...FIELD_SECTIONS.map(([group, name, fields]) => ({
    id: slug(name),
    group,
    name,
    fields: fields.map(([field, kind]) => ({ name: field, kind })),
  })),
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
  s.fields.map((f) => ({
    id: `${s.id}/${slug(f.name)}`,
    name: f.name,
    sectionId: s.id,
    kind: f.kind,
  })),
);

// A contact role, as opposed to a field.
export const isContactRole = (f: { sectionId: string }) =>
  f.sectionId === CONTACT_ROLES_SECTION;

export const OTC_FIELD_IDS = new Set(OTC_FIELDS.map((f) => f.id));
export const OTC_SECTION_IDS = new Set(OTC_SECTIONS.map((s) => s.id));
export const sectionById = (id: string) =>
  OTC_SECTIONS.find((s) => s.id === id);

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
