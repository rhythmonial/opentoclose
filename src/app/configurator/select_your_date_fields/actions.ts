"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { calcComplete, cleanCalc, type DateCalc } from "@/lib/dateCalculations";

const STEP_KEY = "select_your_date_fields";
const PAGE = `/configurator/${STEP_KEY}`;

// Saves how one date field is calculated (or that it isn't checked).
export async function saveDateCalc(
  accountId: string | null,
  calc: DateCalc,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const clean = cleanCalc(calc);
  if (!clean) return { ok: false, error: "Unknown date field." };

  const { error } = await supabase.from("date_calculations").upsert(
    { ...clean, client_account_id: account, updated_at: new Date().toISOString() },
    { onConflict: "client_account_id,otc_field" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Marks the lesson complete once the checked dates are all filled in.
export async function finishDateFields() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");

  const { data } = await supabase
    .from("date_calculations")
    .select("*")
    .eq("client_account_id", accountId);
  const checked = (data ?? []).filter((c) => c.enabled) as DateCalc[];
  if (checked.length === 0 || !checked.every(calcComplete)) redirect(PAGE);

  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}
