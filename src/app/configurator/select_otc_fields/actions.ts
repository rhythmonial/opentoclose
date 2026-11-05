"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import type { ContractBlank } from "@/lib/contractBlanks";
import { withWorkflowTypes } from "@/lib/fieldTypes";
import {
  cleanFieldNames,
  cleanGroupsDone,
  cleanOtcSelection,
  OTC_FIELDS,
  SELECTABLE_GROUPS,
} from "@/lib/otcFields";
import {
  assignContractField,
  cleanWorkflowFields,
  isActive,
  newOtcFieldsFrom,
  workflowKeys,
  type WorkflowField,
} from "@/lib/workflowFields";

const STEP_KEY = "select_otc_fields";
const PAGE = `/configurator/${STEP_KEY}`;

export type OtcFieldSelection = {
  // OTC fields the client needs that aren't on their contracts.
  fields: string[];
  // Field id -> how the client would like it displayed.
  names: Record<string, string>;
  groupsDone: string[];
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
  const known = new Map(
    [...OTC_FIELDS, ...(await newFieldsOf(supabase, account))].map((f) => [f.id, f.name] as const),
  );
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      fields: cleanOtcSelection(selection.fields),
      field_names: cleanFieldNames(selection.names, known),
      groups_done: cleanGroupsDone(selection.groupsDone),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Assigns a contract field (from Upload Your Contracts) to an OTC field, as
// Assign Your Workflow Fields does.
export async function assignFromContract(
  accountId: string | null,
  documentId: string,
  key: string,
  otcFieldId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { data: doc } = await supabase
    .from("contract_documents")
    .select("blanks, workflow_fields")
    .eq("id", documentId)
    .eq("client_account_id", account)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Contract not found." };
  const to = [...OTC_FIELDS, ...(await newFieldsOf(supabase, account))].find(
    (f) => f.id === otcFieldId,
  );
  if (!to) return { ok: false, error: "Unknown field." };

  const keys = workflowKeys(doc.blanks as ContractBlank[]);
  if (keys.get(key) !== key) return { ok: false, error: "That contract field is gone." };
  const current = cleanWorkflowFields(doc.workflow_fields, keys);
  const kept = cleanWorkflowFields(assignContractField(current, key, to), keys);
  const { error } = await supabase
    .from("contract_documents")
    .update({
      blanks: withWorkflowTypes(doc.blanks as ContractBlank[], kept),
      workflow_fields: kept,
      workflow_field_ids: kept.filter(isActive).map((f) => f.id),
      workflow_fields_updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  revalidatePath("/configurator/assign_your_workflow_fields");
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
