// A contract field's type, chosen on its boxes in Upload Your Contracts and
// carried into Assign Your Workflow Fields (where it says which Open to
// Close fields it can fill). The two stay in step: a type set while
// uploading becomes the workflow field's type, and changing the type while
// assigning updates the boxes.
import type { ContractBlank } from "@/lib/contractBlanks";
import { NEW_OTC_PREFIX, type WorkflowField } from "@/lib/workflowFields";
import { CONTACT_ROLES_SECTION, OTC_FIELD_IDS } from "@/lib/otcFields";

export type BoxFieldType =
  | "contact"
  | "text"
  | "text_area"
  | "currency"
  | "percentage"
  | "date"
  | "number"
  | "choice_field"
  | "choice_option";

// Each type, as the menus list it, with the help shown while it's hovered
// and the short tag shown on its boxes.
export const FIELD_TYPE_OPTIONS: {
  value: BoxFieldType;
  label: string;
  tag: string;
  help: string;
}[] = [
  {
    value: "contact",
    label: "Contact",
    tag: "Contact",
    help: "This includes contact information for a partner of the transaction.",
  },
  {
    value: "text",
    label: "Text",
    tag: "Text",
    help: "This is a short string of text, but could also be numbers that don't require calculation, like a parcel or MLS number.",
  },
  {
    value: "text_area",
    label: "Text area",
    tag: "Text area",
    help: "This should be text that is typically longer and may need formatting (bold, italic, underline, etc.).",
  },
  {
    value: "currency",
    label: "Decimal: Dollar ($)",
    tag: "$",
    help: "This will appear as a dollar amount. Example: $500,000",
  },
  {
    value: "percentage",
    label: "Decimal: Percentage (%)",
    tag: "%",
    help: "This will appear as a percentage. Example: 30%",
  },
  { value: "date", label: "Date", tag: "Date", help: "This is a typical date field." },
  {
    value: "number",
    label: "Number",
    tag: "#",
    help: "This will appear as a number without commas or dashes and is designed to work with the Date Calculation tool.",
  },
  {
    value: "choice_field",
    label: "Choice field",
    tag: "Choice field",
    help: "This is a field that has multiple items to select from.",
  },
  {
    value: "choice_option",
    label: "Choice option",
    tag: "Option",
    help: "This is an option in a field with multiple selections and belongs under a specific choice field.",
  },
];

const VALUES = new Set(FIELD_TYPE_OPTIONS.map((t) => t.value));
export const isBoxFieldType = (v: unknown): v is BoxFieldType =>
  typeof v === "string" && VALUES.has(v as BoxFieldType);

// The workflow field settings for a type.
export function workflowTypeOf(t: BoxFieldType): Omit<WorkflowField, "id"> {
  if (t === "currency" || t === "percentage") return { type: "decimal", decimal_format: t };
  if (t === "choice_field") return { type: "choice", choice_role: "question" };
  if (t === "choice_option") return { type: "choice", choice_role: "option" };
  return { type: t };
}

// A workflow field's type, as a box type (none until it's complete enough).
export function boxTypeOf(f: Pick<WorkflowField, "type" | "decimal_format" | "choice_role">) {
  if (f.type === "decimal") return f.decimal_format;
  if (f.type === "choice") {
    return f.choice_role === "question"
      ? "choice_field"
      : f.choice_role === "option"
        ? "choice_option"
        : undefined;
  }
  return f.type;
}

// What a field's boxes (a box, or boxes linked as one) say about it: its
// type, and for choice fields and options, how they're tied together.
type BoxInfo = {
  type: BoxFieldType;
  choiceOf?: string;
  choiceName?: string;
  optionTitle?: string;
  options?: string[];
  contactRole?: string;
  contactRoleName?: string;
};
function infoByKey(blanks: ContractBlank[]) {
  const out = new Map<string, BoxInfo>();
  for (const b of blanks) {
    if (!b.id || !b.fieldType) continue;
    const key = b.group ?? b.id;
    if (out.has(key)) continue;
    out.set(key, {
      type: b.fieldType,
      ...(b.fieldType === "choice_option" && b.choiceOf ? { choiceOf: b.choiceOf } : {}),
      ...(b.fieldType === "choice_option" && b.choiceName ? { choiceName: b.choiceName } : {}),
      ...(b.fieldType === "choice_option" && b.optionTitle ? { optionTitle: b.optionTitle } : {}),
      ...(b.fieldType === "choice_field" && b.choiceOptions?.length ? { options: b.choiceOptions } : {}),
      ...(b.fieldType === "contact" && b.contactRole ? { contactRole: b.contactRole } : {}),
      ...(b.fieldType === "contact" && b.contactRoleName ? { contactRoleName: b.contactRoleName } : {}),
    });
  }
  return out;
}

// A field with what its boxes say about its choice field / option.
function withChoiceInfo(f: WorkflowField, info: BoxInfo): WorkflowField {
  const next: WorkflowField = { ...f };
  if (info.type === "choice_option") {
    if (info.choiceOf) {
      // A different choice field set while uploading needs picking again
      // in Assign Your Workflow Fields.
      if (info.choiceOf !== f.question_id) delete next.question_confirmed;
      next.question_id = info.choiceOf;
      delete next.question_text;
      delete next.question_section;
      // A choice field the client created: OTC gets a new one by that name.
      if (info.choiceOf.startsWith(NEW_OTC_PREFIX) && info.choiceName) {
        next.question_text = info.choiceName;
      }
    }
    if (info.optionTitle) next.option_title = info.optionTitle;
  }
  if (info.type === "choice_field") {
    if (info.options) next.options = info.options;
    else delete next.options;
  }
  // A contact's role is its OTC field (a new role in Contact Roles).
  if (info.type === "contact" && info.contactRole) {
    next.otc_field = info.contactRole;
    delete next.otc_field_name;
    delete next.otc_section;
    if (info.contactRole.startsWith(NEW_OTC_PREFIX) && info.contactRoleName) {
      next.otc_field_name = info.contactRoleName;
      next.otc_section = CONTACT_ROLES_SECTION;
    }
  }
  return next;
}

// Workflow fields after the upload's types: a typed field that isn't in the
// workflow yet is added with that type (still needing its OTC field), and
// one whose type has changed takes the new type (its OTC field goes, since
// it was for the old type). Removed fields stay removed. A field whose type
// was cleared (it had one in `before`) leaves the workflow. Choice options
// picked for a choice field are tied to it, with their titles, and a
// choice field keeps the options added by hand.
export function withBoxTypes(
  fields: WorkflowField[],
  blanks: ContractBlank[],
  before: ContractBlank[] = [],
): WorkflowField[] {
  const infos = infoByKey(blanks);
  const had = infoByKey(before);
  const out = fields.filter((f) => infos.has(f.id) || !had.has(f.id)).map((f) => {
    const info = infos.get(f.id);
    if (!info || f.removed) return f;
    if (boxTypeOf(f) !== info.type) return withChoiceInfo({ id: f.id, ...workflowTypeOf(info.type) }, info);
    return withChoiceInfo(f, info);
  });
  const have = new Set(out.map((f) => f.id));
  for (const [key, info] of infos) {
    if (!have.has(key)) out.push(withChoiceInfo({ id: key, ...workflowTypeOf(info.type) }, info));
  }
  return out;
}

// Boxes after the workflow fields (a type changed while assigning shows on
// the boxes in Upload Your Contracts too, as do an option's choice field on
// this contract and its title, and a choice field's added options).
export function withWorkflowTypes(
  blanks: ContractBlank[],
  fields: WorkflowField[],
): ContractBlank[] {
  const byKey = new Map<string, WorkflowField>();
  for (const f of fields) if (!f.removed && boxTypeOf(f)) byKey.set(f.id, f);
  const keys = new Set(blanks.filter((b) => b.id).map((b) => b.group ?? b.id!));
  return blanks.map((b) => {
    if (!b.id) return b;
    const f = byKey.get(b.group ?? b.id);
    if (!f) return b;
    const next: ContractBlank = { ...b, fieldType: boxTypeOf(f)! };
    delete next.choiceOf;
    delete next.choiceName;
    delete next.optionTitle;
    delete next.choiceOptions;
    delete next.contactRole;
    delete next.contactRoleName;
    if (f.type === "contact" && f.otc_field) {
      next.contactRole = f.otc_field;
      if (f.otc_field.startsWith(NEW_OTC_PREFIX) && f.otc_field_name) {
        next.contactRoleName = f.otc_field_name;
      }
    }
    if (f.choice_role === "option") {
      const q = f.question_id;
      if (q && (keys.has(q) || OTC_FIELD_IDS.has(q))) next.choiceOf = q;
      if (q?.startsWith(NEW_OTC_PREFIX) && f.question_text) {
        next.choiceOf = q;
        next.choiceName = f.question_text;
      }
      if (f.option_title) next.optionTitle = f.option_title;
    }
    if (f.choice_role === "question" && f.options?.length) next.choiceOptions = f.options;
    return next;
  });
}
