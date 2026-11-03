import { createClient } from "@/lib/supabase/server";

// The client account a configurator works on: a client's own, or (for staff
// helping a client) the one asked for.
export async function configuratorAccount(requested: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, accountId: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", user.id)
    .single();
  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  return {
    supabase,
    user,
    accountId: isStaff ? requested : (profile?.client_account_id ?? null),
  };
}

// Marks a configurator's lesson approved for the signed-in client.
export async function approveStep(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string,
  stepKey: string,
) {
  const { data: account } = await supabase
    .from("client_accounts")
    .select("setup_path")
    .eq("id", accountId)
    .single();
  const { data: step } = await supabase
    .from("setup_steps")
    .select("id")
    .eq("path", account?.setup_path ?? "custom")
    .eq("key", stepKey)
    .maybeSingle();
  if (!step) return;
  await supabase.from("client_step_status").upsert(
    {
      client_id: userId,
      step_id: step.id,
      status: "approved",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,step_id" },
  );
}
