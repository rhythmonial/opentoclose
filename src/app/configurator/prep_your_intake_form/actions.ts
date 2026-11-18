"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { cleanIds, cleanIntakeConditions, cleanIntakeTriggers } from "@/lib/intakeForm";

const STEP_KEY = "prep_your_intake_form";
const PAGE = `/configurator/${STEP_KEY}`;

// Saves the whole intake form: fields added beyond the contract's, the
// required ones, and each field's triggers and conditions.
export async function saveIntakeForm(
  accountId: string | null,
  form: { added: string[]; required: string[]; triggers: unknown; conditions: unknown },
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("client_intake_forms").upsert(
    {
      client_account_id: account,
      added: cleanIds(form.added),
      required: cleanIds(form.required),
      triggers: cleanIntakeTriggers(form.triggers),
      conditions: cleanIntakeConditions(form.conditions),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

export async function finishIntakeForm() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}
