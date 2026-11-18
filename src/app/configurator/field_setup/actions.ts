"use server";

import { configuratorAccount } from "@/lib/configuratorAccount";

// Marks a new field as created in Open to Close (or not), for Field Setup's
// red / green + beside it.
export async function setFieldBuilt(
  accountId: string | null,
  fieldId: string,
  built: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const id = String(fieldId).slice(0, 200);
  const { data } = await supabase
    .from("client_field_organization")
    .select("built_fields")
    .eq("client_account_id", account)
    .maybeSingle();
  const now = new Set(data?.built_fields ?? []);
  if (built) now.add(id);
  else now.delete(id);
  const { error } = await supabase
    .from("client_field_organization")
    .upsert(
      { client_account_id: account, built_fields: [...now], updated_at: new Date().toISOString() },
      { onConflict: "client_account_id" },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}
