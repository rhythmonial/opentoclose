"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import {
  cleanFieldNames,
  cleanGroupsDone,
  cleanOtcSelection,
  SELECTABLE_GROUPS,
} from "@/lib/otcFields";

const STEP_KEY = "select_otc_fields";
const PAGE = `/configurator/${STEP_KEY}`;

export type OtcFieldSelection = {
  fields: string[];
  // OTC field id -> what the client calls it.
  names: Record<string, string>;
  groupsDone: string[];
};

// Saves the fields a client checked (system required ones always count),
// what they call them, and the groups they've finished.
export async function saveOtcFieldSelection(
  accountId: string | null,
  selection: OtcFieldSelection,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const fields = cleanOtcSelection(selection.fields);
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      fields,
      field_names: cleanFieldNames(selection.names, fields),
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
