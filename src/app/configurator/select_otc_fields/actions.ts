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
  removed: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  const isChoice =
    OTC_FIELDS.some((f) => f.id === fieldId && f.kind === "choice") ||
    (fieldId.startsWith(NEW_OTC_PREFIX) && fieldId.length <= 120);
  if (!isChoice) return { ok: false, error: "Unknown field." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const list = (items: string[]) => {
    const out: string[] = [];
    for (const x of items.slice(0, 200)) {
      const t = String(x ?? "").trim().slice(0, 120);
      if (t && !out.some((c) => c.toLowerCase() === t.toLowerCase())) out.push(t);
    }
    return out;
  };
  const { data } = await supabase
    .from("client_field_organization")
    .select("choice_edits")
    .eq("client_account_id", account)
    .maybeSingle();
  const edits = (data?.choice_edits ?? {}) as Record<string, { removed?: string[]; added?: string[] }>;
  const choice_edits = { ...edits, [fieldId]: { removed: list(removed), added: list(added) } };
  const { error } = await supabase.from("client_field_organization").upsert(
    { client_account_id: account, choice_edits, updated_at: new Date().toISOString() },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

const fieldIdOk = (id: string) =>
  OTC_FIELDS.some((f) => f.id === id) || /^new-otc:[0-9a-f-]{36}$/i.test(id);

// Ties a number field to the date it's the days for (a date calculation
// whose days are a blank on the contract), from Customize Your Fields. A
// date they add here gets its name. The number is untied from any other
// date, and no longer marked as not a date's days.
export async function tieNumberToDate(
  accountId: string | null,
  numberId: string,
  dateId: string,
  dateName?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!fieldIdOk(numberId) || !fieldIdOk(dateId)) return { ok: false, error: "Unknown field." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  await supabase
    .from("date_calculations")
    .update({ number_field: null, days_on_contract: false, updated_at: new Date().toISOString() })
    .eq("client_account_id", account)
    .eq("number_field", numberId)
    .neq("otc_field", dateId);
  const { data: existing } = await supabase
    .from("date_calculations")
    .select("*")
    .eq("client_account_id", account)
    .eq("otc_field", dateId)
    .maybeSingle();
  const name = dateName?.trim().slice(0, 120);
  const { error } = await supabase.from("date_calculations").upsert(
    {
      ...(existing ?? {}),
      client_account_id: account,
      otc_field: dateId,
      enabled: true,
      days: null,
      days_on_contract: true,
      number_field: numberId,
      ...(dateId.startsWith(NEW_OTC_PREFIX) && name ? { field_name: name } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id,otc_field" },
  );
  if (error) return { ok: false, error: error.message };
  await markNotDate(supabase, account, numberId, false, dateId);
  revalidatePath("/configurator/select_your_date_fields");
  return { ok: true };
}

// Marks a number field as not the days for any date (or takes that back).
export async function setNumberNotDate(
  accountId: string | null,
  numberId: string,
  on: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!fieldIdOk(numberId)) return { ok: false, error: "Unknown field." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  if (on) {
    await supabase
      .from("date_calculations")
      .update({ number_field: null, days_on_contract: false, updated_at: new Date().toISOString() })
      .eq("client_account_id", account)
      .eq("number_field", numberId);
  }
  const error = await markNotDate(supabase, account, numberId, on);
  if (error) return { ok: false, error };
  revalidatePath("/configurator/select_your_date_fields");
  return { ok: true };
}

// Records in the selection whether a number field isn't a date's days, and
// the date it was tied to here (null: none).
async function markNotDate(
  supabase: Supabase,
  account: string,
  numberId: string,
  on: boolean,
  tiedTo: string | null = null,
) {
  const { data } = await supabase
    .from("client_otc_field_selections")
    .select("numbers_not_dates, number_ties")
    .eq("client_account_id", account)
    .maybeSingle();
  const list = (Array.isArray(data?.numbers_not_dates) ? data.numbers_not_dates : []).filter(
    (x): x is string => typeof x === "string" && x !== numberId,
  );
  const ties = { ...((data?.number_ties ?? {}) as Record<string, string>) };
  if (tiedTo) ties[numberId] = tiedTo;
  else delete ties[numberId];
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      numbers_not_dates: on ? [...list, numberId].slice(-500) : list,
      number_ties: ties,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  return error?.message ?? null;
}

// "Refresh all fields": Customize Your Fields back to how it started (no
// extra fields checked, renames, placeholders, fields added here, groups
// done, or number fields' dates picked here).
export async function resetFinalizeFields(accountId: string | null): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      fields: [],
      field_names: {},
      groups_done: [],
      custom_fields: [],
      placeholders: {},
      numbers_not_dates: [],
      number_ties: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}
