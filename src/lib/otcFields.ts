import type { WorkflowFieldType } from "@/lib/workflowFields";

// The fields that come with an Open to Close account, by group and section
// as they appear in OTC's Field Editor, with their types (used to suggest
// fields when a client picks a field type). "currency" is OTC's Decimal
// Dollar type.
export type Kind = WorkflowFieldType | "currency" | "percentage";

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
  "Buyer",
  "Buyer's Agent Transaction Coordinator", // (confirm)
  "Buyer's Agent",
  "Buyer's Co Agent",
  "Cleaning Company",
  "Escrow Officer",
  "Escrow Officer Assistant",
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
  "Listing Agent Transaction Coordinator", // (confirm)
  "Listing Agent",
  "Listing Co Agent",
  "Photographer",
  "Referral Agent",
  "Referral Company",
  "Seller",
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
      ["State", "text"],
      ["Zip", "text"],
      ["County", "text"],
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
  ["Additional Fields", "Open House Details", []],
  ["Additional Fields", "Showing Details", []],
  ["Additional Fields", "New Construction Details", []],
  ["Additional Fields", "Rental Details", []],
  ["Additional Fields", "Radon Details", []],
  ["Additional Fields", "Pool Details", []],
  ["Additional Fields", "Survey Details", []],
  [
    "Additional Fields",
    "Additional Fields",
    [
      ["Inclusions", "text_area"],
      ["Exclusions", "text_area"],
      ["Offer Created Date", "date"],
      ["Extension Agreement - Days", "number"],
      ["Extension Agreement - Date", "date"],
    ],
  ],
  ["Additional Fields", "Termite & Pest Details", []],
  ["Additional Fields", "Solar Details", []],
  [
    "Additional Fields",
    "Well Details",
    [
      ["Well Onsite", "choice"],
      ["Will There Be A Well Inspection", "choice"],
      ["Well Inspection Date", "date"],
    ],
  ],
  [
    "Additional Fields",
    "Septic Details",
    [
      ["Septic Onsite", "choice"],
      ["Will There Be A Septic Inspection", "choice"],
      ["Septic Inspection Date", "date"],
    ],
  ],
  [
    "Additional Fields",
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
    "Additional Fields",
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
    // Ids stay as they were when OTC called this section "Additional Fields
    // (Not In Use)", so saved fields keep matching.
    id: slug(name === "Additional Fields" ? "Additional Fields (Not In Use)" : name),
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

// Fields Open to Close requires on every transaction, in the order they're
// listed. They lead every list of OTC fields.
export const SYSTEM_REQUIRED_LABEL = "System required";
export const SYSTEM_REQUIRED_IDS = [
  "address/address",
  "address/city",
  "address/state",
  "address/zip",
  "critical-details/contract-status",
  "critical-details/client-type",
];
export const SYSTEM_REQUIRED_FIELDS: OtcField[] = SYSTEM_REQUIRED_IDS.map(
  (id) => {
    const f = OTC_FIELDS.find((x) => x.id === id);
    if (!f) throw new Error(`System required field ${id} isn't in the catalog`);
    return f;
  },
);
export const isSystemRequired = (id: string) =>
  SYSTEM_REQUIRED_IDS.includes(id);
// Sorts system required fields first (in their order), leaving the rest
// where they were.
export const requiredRank = (id: string) => {
  const i = SYSTEM_REQUIRED_IDS.indexOf(id);
  return i === -1 ? SYSTEM_REQUIRED_IDS.length : i;
};

// Other names a field goes by on contracts and in other states, shown
// beside it and matched by searches (e.g. searching "Effective Date" finds
// Acceptance Date). By field id.
export const OTC_FIELD_ALIASES: Record<string, string[]> = {
  "critical-details/acceptance-date": [
    "Contract Date",
    "Effective Date",
    "Mutual Acceptance Date",
    "Binding Agreement Date",
    "Ratification Date",
    "Execution Date",
  ],
  "critical-details/closing-date": ["Settlement Date", "Close of Escrow (COE)"],
  "critical-details/purchase-amount": ["Purchase Price", "Sales Price", "Contract Price"],
  "critical-details/possession-date": ["Occupancy Date", "Move-in Date"],
  "critical-details/final-walkthough-date": ["Final Walk-through Date"],
  "critical-details/seller-concessions": ["Seller Credit", "Seller Contribution"],
  "property-details/tax-id": ["Parcel Number", "APN", "PIN"],
  "earnest-money-details/earnest-money-amount": [
    "Deposit",
    "Escrow Deposit",
    "Good Faith Deposit",
    "Binder",
  ],
  "earnest-money-details/earnest-money-held-by": ["Escrow Holder", "Escrow Agent"],
  "inspection-details/inspection-period-date": [
    "Due Diligence Date",
    "Inspection Contingency Date",
    "Option Period End Date",
  ],
  "inspection-details/inspection-period-days": ["Due Diligence Period", "Option Period"],
  "financing-details/loan-approval-due-date": [
    "Financing Contingency Date",
    "Loan Commitment Date",
  ],
  "appraisal-details/appraisal-due-date": ["Appraisal Contingency Date"],
  "disclosures-and-addendums/seller-disclosure-due-date": ["Disclosure Delivery Date"],
  "cancellation-termination/termination-date": ["Cancellation Date"],
  "closing-details/deed-recorded-date": ["Recording Date"],
  "critical-listing-details/listing-price": ["List Price", "Asking Price"],
  "critical-listing-details/listing-agreement-expiration-date": ["Listing Expiration Date"],
  "hoa-details/is-there-an-hoa": ["POA", "Association", "Condo Association"],
  "home-warranty-details/home-warranty-offered": ["Home Protection Plan"],
};

// The fields a client can select in Select OTC Fields: every field from the
// OTC catalog (not contact roles), by section.
export const SELECTABLE_SECTIONS = OTC_SECTIONS.filter(
  (s) => s.id !== CONTACT_ROLES_SECTION && s.fields.length > 0,
);

const SELECTABLE_IDS = new Set(
  SELECTABLE_SECTIONS.flatMap((s) => s.fields.map((f) => `${s.id}/${slug(f.name)}`)),
);

// A client's checked fields: known, selectable ones only, in catalog order,
// always including the system required fields.
export function cleanOtcSelection(raw: unknown): string[] {
  const picked = new Set(Array.isArray(raw) ? raw.map(String) : []);
  for (const id of SYSTEM_REQUIRED_IDS) picked.add(id);
  return OTC_FIELDS.filter((f) => SELECTABLE_IDS.has(f.id) && picked.has(f.id)).map((f) => f.id);
}

// How a field's name becomes the last part of its id.
export const slugOf = slug;

// The field groups, in OTC's order (tabs in Select OTC Fields).
export const SELECTABLE_GROUPS = [...new Set(SELECTABLE_SECTIONS.map((s) => s.group))];

export const cleanGroupsDone = (raw: unknown): string[] =>
  SELECTABLE_GROUPS.filter((g) => Array.isArray(raw) && raw.includes(g));

// How a client would like their fields displayed: field id -> their name,
// only when it differs from OTC's. `known` holds the ids it can be for
// (OTC's fields and the client's new ones).
export function cleanFieldNames(raw: unknown, known: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const name = String(value ?? "").trim().slice(0, 120);
    const otcName = known.get(id);
    if (!otcName || !name || name.toLowerCase() === otcName.toLowerCase()) continue;
    out[id] = name;
  }
  return out;
}

// A field a client adds themselves in Finalize Your Fields (one Open to
// Close doesn't have and isn't on their contracts), in one of OTC's
// sections, with its choices when it's a choice field.
export type CustomField = {
  id: string;
  name: string;
  sectionId: string;
  kind: Kind;
  options?: string[];
};

export const CUSTOM_FIELD_KINDS: { value: Kind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "text_area", label: "Text Area" },
  { value: "currency", label: "Decimal: Dollar" },
  { value: "percentage", label: "Decimal: Percentage" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "choice", label: "Choice" },
];

// Choice options typed in one box, separated by commas.
export function splitOptions(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().slice(0, 120);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 100);
}

export function cleanCustomFields(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  const kinds = new Set(CUSTOM_FIELD_KINDS.map((k) => k.value));
  const out: CustomField[] = [];
  for (const item of raw.slice(0, 200)) {
    const f = item as Partial<CustomField> | null;
    if (!f || typeof f.id !== "string" || !/^new-otc:[0-9a-f-]{36}$/i.test(f.id)) continue;
    const name = String(f.name ?? "").trim().slice(0, 120);
    if (!name || out.some((o) => o.id === f.id)) continue;
    // Any of OTC's field sections (empty ones too), not contact roles.
    if (
      typeof f.sectionId !== "string" ||
      f.sectionId === CONTACT_ROLES_SECTION ||
      !OTC_SECTION_IDS.has(f.sectionId)
    )
      continue;
    if (!kinds.has(f.kind as Kind)) continue;
    const field: CustomField = { id: f.id, name, sectionId: f.sectionId, kind: f.kind as Kind };
    if (field.kind === "choice" && Array.isArray(f.options)) {
      const options = splitOptions(f.options.map(String).join(","));
      if (options.length > 0) field.options = options;
    }
    out.push(field);
  }
  return out;
}

// Open to Close's choice fields that are yes/no questions.
const YES_NO_FIELDS = new Set([
  "Are there any seller paid closing costs",
  "Is House Built Prior to 1978",
  "Will Seller Disclosures Be Required",
  "Will a Lead-Based Paint Disclosure Be Required",
  "Will There Be An Inspection",
  "Inspection Repair Receipts Delivered - Y/N",
  "Is There An HOA",
  "Is There a Loan",
  "Will There Be An Appraisal",
  "Appraisal Scheduled - Y/N",
  "Appraisal Met Value - Y/N",
  "Appraisal Conditions - Y/N",
  "Appraisal Re-inspection Scheduled - Y/N",
  "Home Warranty Offered",
  "Deed Released to Record",
  "Walkthrough Waived",
  "Will We Be Doing a Coming Soon",
  "Is there an Alarm",
  "Are we scheduling photos",
  "Will There be a Sign Installed",
  "Are We Doing Staging",
  "Are We Ordering a Listing Home Protection Plan",
  "Is there a Referral Fee",
  "Referral W9 Received",
  "Well Onsite",
  "Will There Be A Well Inspection",
  "Septic Onsite",
  "Will There Be A Septic Inspection",
]);

// The options Open to Close's other choice fields come with, by name.
const CHOICE_OPTIONS_BY_NAME: Record<string, string[]> = {
  "Contract Status": [
    "Listing - Pre-MLS",
    "Listing - Active",
    "Listing - Under Contract",
    "Listing - Withdrawn-Cancelled",
    "Under Contract",
    "Closed",
    "Contract Terminated",
  ],
  "Client Type": ["Buyer", "Seller", "Dual"],
  "Property Type": [
    "Single Family Residential",
    "Condo",
    "Townhouse",
    "Multi-Family Dwelling",
    "New Construction",
    "Vacant Land",
  ],
  "Property Occupant Type": ["Owner Occupied", "Tenant Occupied", "Vacant"],
  "Earnest Money Held By": ["Escrow Agent", "Title", "Attorney", "Buyer Broker", "Listing Broker"],
  "Earnest Money Delivery Status": ["Delivered", "Not Delivered", "Waived"],
  "Seller Disclosure Delivery Status": ["Not Delivered", "Delivered", "Waived"],
  "Type of Inspections": ["General", "Pest-Termite", "Pool", "Radon", "Roof", "Lead Based Paint"],
  "Buyers Response to Repairs": ["Accepts As Is", "Asks for Repairs", "Asks for Credit", "Cancels"],
  "Results of Lead-Based Paint Assessment": [
    "Requests Deficiencies Corrected",
    "Accepts Lead-Based Paint As-is",
  ],
  "HOA Dues Payment Frequency": ["Monthly", "Semi-Yearly", "Annual"],
  "Loan Type": ["Conventional", "VA", "FHA", "Rural - USDA", "Other"],
  "Buyers Loan Approval Status": [
    "Pending Approval - Conditions",
    "Fully Approved - Clear to Close",
  ],
  "CD Delivery Status": [
    "Conditions Pending - Not Sent",
    "Sent to Buyer - Not Acknowledged",
    "Sent to Buyer - Acknowledged and Signed",
  ],
  "Home Warranty is Paid By": ["Buyer", "Seller", "Buyers Agent", "Listing Agent"],
  "Home Warranty Ordered By": ["Transaction Coordinator", "Buyer Agent", "Listing Agent"],
  "What Photo Types would you like ordered": [
    "Standard Photo Package",
    "Videographer",
    "Twilight",
    "Virtual Tour",
    "Drone",
  ],
  "Sign Installation Type": ["Yard", "Window", "Directionals"],
  "Referral Type": ["Agent Referral", "HomeLight", "Zillow Flex"],
  "Listing Side Commission Flat Fee or Percentage": ["Flat Fee", "Percentage"],
  "Buyer Side Commission Flat Fee or Percentage": ["Flat Fee", "Percentage"],
  "Referral Flat Fee or Percentage": ["Flat Fee", "Percentage"],
};

// The options Open to Close's own choice fields come with, by field id.
export const OTC_CHOICE_OPTIONS: Record<string, string[]> = Object.fromEntries(
  OTC_FIELDS.filter((f) => f.kind === "choice").flatMap((f) =>
    YES_NO_FIELDS.has(f.name)
      ? [[f.id, ["Yes", "No"]]]
      : CHOICE_OPTIONS_BY_NAME[f.name]
        ? [[f.id, CHOICE_OPTIONS_BY_NAME[f.name]]]
        : [],
  ),
);
