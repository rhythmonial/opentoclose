import type { createClient } from "@/lib/supabase/server";
import { allPlaceholders, cleanPlaceholders, contractLines } from "@/lib/placeholders";
import { orgSectionsWith, type OrgSection } from "@/lib/fieldOrganization";
import {
  cleanCustomFields,
  cleanCustomSections,
  cleanFieldNames,
  cleanOtcSelection,
  CONTACT_ROLES_SECTION,
  isContactRole,
  OTC_FIELDS,
  type CustomField,
  type OtcField,
} from "@/lib/otcFields";
import {
  isActive,
  newOtcFieldsFrom,
  optionTitlesOf,
  otcTargetOf,
  type WorkflowField,
} from "@/lib/workflowFields";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type FieldUse = {
  // Every field the client uses: Open to Close's fields they checked in
  // Customize Your Fields or assigned on their contracts (system required
  // ones always), the new fields they added while assigning, and the ones
  // they added in Customize Your Fields.
  inUse: Set<string>;
  newFields: OtcField[];
  custom: CustomField[];
  // OTC's sections with the ones the client added.
  sections: OrgSection[];
  // How they'd like fields displayed (id -> name).
  names: Record<string, string>;
  // Choice options on their contracts, by the field they're for.
  contractOptions: Record<string, string[]>;
  // Each field's placeholder ("134- if blank = 3").
  placeholders: Record<string, string>;
};

export async function loadFieldUse(supabase: Supabase, accountId: string): Promise<FieldUse> {
  const [{ data: saved }, { data: docs }] = await Promise.all([
    supabase
      .from("client_otc_field_selections")
      .select("fields, field_names, custom_fields, custom_sections, placeholders")
      .eq("client_account_id", accountId)
      .maybeSingle(),
    supabase
      .from("contract_documents")
      .select("blanks, workflow_fields, created_at, upload_order")
      .eq("client_account_id", accountId)
      .eq("is_scanned", false),
  ]);
  const active = (docs ?? [])
    .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
    .filter(isActive);
  const assigned = new Set(active.map(otcTargetOf).filter((id): id is string => Boolean(id)));
  const newFields = newOtcFieldsFrom(active).filter((f) => !isContactRole(f) && assigned.has(f.id));
  const custom = cleanCustomFields(saved?.custom_fields);
  const builtIn = OTC_FIELDS.filter((f) => f.sectionId !== CONTACT_ROLES_SECTION);
  const inUse = new Set<string>([
    ...cleanOtcSelection(saved?.fields ?? []),
    ...builtIn.filter((f) => assigned.has(f.id)).map((f) => f.id),
    ...newFields.map((f) => f.id),
    ...custom.map((f) => f.id),
  ]);
  const names = cleanFieldNames(
    saved?.field_names,
    new Map([...OTC_FIELDS, ...newFields, ...custom].map((f) => [f.id, f.name] as const)),
  );
  // Options tied to a choice field (directly, or through a choice field on
  // the contract that's assigned to one), and options added by hand to a
  // choice field on the contract.
  const questionOtc = new Map(
    active
      .filter((f) => f.choice_role === "question" && f.otc_field)
      .map((f) => [f.id, f.otc_field!] as const),
  );
  const contractOptions: Record<string, string[]> = {};
  const add = (id: string, title: string) => {
    const list = (contractOptions[id] ??= []);
    if (!list.some((t) => t.toLowerCase() === title.toLowerCase())) list.push(title);
  };
  for (const f of active) {
    if (f.choice_role === "option" && f.question_id) {
      for (const t of optionTitlesOf(f)) add(questionOtc.get(f.question_id) ?? f.question_id, t);
    }
    if (f.choice_role === "question" && f.otc_field) for (const t of f.options ?? []) add(f.otc_field, t);
  }
  // Placeholders: the ones they set in Customize Your Fields, and numbers'
  // if-blank values from their contracts.
  const placeholders = allPlaceholders(contractLines(docs ?? []), cleanPlaceholders(saved?.placeholders));
  const sections = orgSectionsWith(cleanCustomSections(saved?.custom_sections));
  return { inUse, newFields, custom, sections, names, contractOptions, placeholders };
}
