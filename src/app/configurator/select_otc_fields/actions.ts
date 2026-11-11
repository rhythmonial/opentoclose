"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { cleanPlaceholders } from "@/lib/placeholders";
import {
  cleanCustomFields,
  cleanFieldNames,
  type CustomField,
  cleanGroupsDone,
  cleanOtcSelection,
  OTC_FIELDS,
  SELECTABLE_GROUPS,
} from "@/lib/otcFields";
import { isActive, NEW_OTC_PREFIX, newOtcFieldsFrom, type WorkflowField } from "@/lib/workflowFields";

const STEP_KEY = "select_otc_fields";
const PAGE = `/configurator/${STEP_KEY}`;

export type OtcFieldSelection = {
  // OTC fields the client needs that aren't on their contracts.
  fields: string[];
  // Field id -> how the client would like it displayed.
  names: Record<string, string>;
  groupsDone: string[];
  // Fields they added themselves.
  custom: CustomField[];
};

type Supabase = Awaited<ReturnType<typeof configuratorAccount>>["supabase"];

// The client's new fields (added while assigning), across their contracts.
async function newFieldsOf(supabase: Supabase, account: string) {
  const { data } = await supabase
    .from("contract_documents")
    .select("workflow_fields")
    .eq("client_account_id", account);
  return newOtcFieldsFrom(
    (data ?? [])
      .flatMap((d) => (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []))
      .filter(isActive),
  );
}

// Saves the fields a client checked as needed (system required ones always
// count), how they'd like fields displayed, and the groups they've finished.
export async function saveOtcFieldSelection(
  accountId: string | null,
  selection: OtcFieldSelection,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const custom = cleanCustomFields(selection.custom);
  const known = new Map(
    [...OTC_FIELDS, ...(await newFieldsOf(supabase, account)), ...custom].map(
      (f) => [f.id, f.name] as const,
    ),
  );
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      fields: cleanOtcSelection(selection.fields),
      field_names: cleanFieldNames(selection.names, known),
      groups_done: cleanGroupsDone(selection.groupsDone),
      custom_fields: custom,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Marks the lesson complete once every field group is done.
export async function finishSelectOtcFields() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  const { data } = await supabase
    .from("client_otc_field_selections")
    .select("groups_done")
    .eq("client_account_id", accountId)
    .maybeSingle();
  if (cleanGroupsDone(data?.groups_done).length < SELECTABLE_GROUPS.length) redirect(PAGE);
  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}

// Saves a field's placeholder ("" removes it, even a number's from its
// contract).
export async function saveFieldPlaceholder(
  accountId: string | null,
  fieldId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  if (!fieldId || fieldId.length > 120) return { ok: false, error: "Unknown field." };
  const { data: saved } = await supabase
    .from("client_otc_field_selections")
    .select("placeholders")
    .eq("client_account_id", account)
    .maybeSingle();
  const placeholders = { ...cleanPlaceholders(saved?.placeholders), [fieldId]: text.replace(/\s+/g, " ").trim().slice(0, 200) };
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    { client_account_id: account, placeholders, updated_at: new Date().toISOString() },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Saves the choice options a client added to a choice field (an Open to
// Close one, or one they added), kept with the ones Organize Your Fields
// edits.
export async function saveChoiceAdded(
  accountId: string | null,
  fieldId: string,
  added: string[],
): Promise<{ ok: boolean; error?: string }> {
  const isChoice =
    OTC_FIELDS.some((f) => f.id === fieldId && f.kind === "choice") ||
    (fieldId.startsWith(NEW_OTC_PREFIX) && fieldId.length <= 120);
  if (!isChoice) return { ok: false, error: "Unknown field." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const clean: string[] = [];
  for (const x of added.slice(0, 200)) {
    const t = String(x ?? "").trim().slice(0, 120);
    if (t && !clean.some((c) => c.toLowerCase() === t.toLowerCase())) clean.push(t);
  }
  const { data } = await supabase
    .from("client_field_organization")
    .select("choice_edits")
    .eq("client_account_id", account)
    .maybeSingle();
  const edits = (data?.choice_edits ?? {}) as Record<string, { removed?: string[]; added?: string[] }>;
  const choice_edits = { ...edits, [fieldId]: { removed: edits[fieldId]?.removed ?? [], added: clean } };
  const { error } = await supabase.from("client_field_organization").upsert(
    { client_account_id: account, choice_edits, updated_at: new Date().toISOString() },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}
