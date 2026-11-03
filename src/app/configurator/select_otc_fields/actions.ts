"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { cleanOtcSelection } from "@/lib/otcFields";

const STEP_KEY = "select_otc_fields";
const PAGE = `/configurator/${STEP_KEY}`;

// Saves the fields a client checked (system required ones always count).
export async function saveOtcFieldSelection(
  accountId: string | null,
  fields: string[],
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      fields: cleanOtcSelection(fields),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

export async function finishSelectOtcFields() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}
