"use server";

import { configuratorAccount } from "@/lib/configuratorAccount";

// Lessons with a checklist.
const STEPS = new Set(["document_setup"]);

// Checks (or unchecks) one item on a setup lesson's checklist.
export async function setSetupCheck(
  accountId: string | null,
  stepKey: string,
  key: string,
  checked: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!STEPS.has(stepKey)) return { ok: false, error: "Unknown lesson." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const id = String(key).slice(0, 400);
  const { data } = await supabase
    .from("client_setup_checks")
    .select("checked")
    .eq("client_account_id", account)
    .eq("step_key", stepKey)
    .maybeSingle();
  const now = new Set(data?.checked ?? []);
  if (checked) now.add(id);
  else now.delete(id);
  const { error } = await supabase.from("client_setup_checks").upsert(
    {
      client_account_id: account,
      step_key: stepKey,
      checked: [...now].slice(-5000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id,step_key" },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}
