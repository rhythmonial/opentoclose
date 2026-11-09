import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Everyone on a client account shares one set of progress, setup form and
// plan, stored under the account owner's id. Teammates are just more
// logins for the same account. Returns the owner's id (or their own, for
// the owner or anyone without an account).
export async function progressOwnerId(supabase: Supabase, userId: string): Promise<string> {
  const { data: me } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", userId)
    .single();
  if (!me?.client_account_id || me.role === "client_owner") return userId;
  const { data: owner } = await supabase
    .from("profiles")
    .select("id")
    .eq("client_account_id", me.client_account_id)
    .eq("role", "client_owner")
    .maybeSingle();
  return owner?.id ?? userId;
}
