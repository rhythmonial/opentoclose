"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import {
  cleanFieldNames,
  cleanGroupsDone,
  cleanOtcSelection,
  OTC_FIELDS,
  SELECTABLE_GROUPS,
} from "@/lib/otcFields";
import { isActive, newOtcFieldsFrom, type WorkflowField } from "@/lib/workflowFields";

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
