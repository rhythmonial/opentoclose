import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freeMonthStatus } from "@/lib/coupons";

// Configurators past the first pillar (Getting Started) only open on a
// paid plan (DIY, Setup or a free month). Staff always get in. Sends anyone
// else back to their Setup page.
export async function requireStepAccess(stepKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id, client_accounts(setup_path)")
    .eq("id", user.id)
    .single();
  if (profile?.role === "dev" || profile?.role === "dev_admin") return;
  // End a free month that's run out before checking the plan.
  await freeMonthStatus(profile?.client_account_id);

  const { data: initiation } = await supabase
    .from("setup_initiation")
    .select("engagement_type")
    .eq("client_id", user.id)
    .maybeSingle();
  if (initiation?.engagement_type === "diy" || initiation?.engagement_type === "custom") return;

  const path = profile?.client_accounts?.setup_path ?? "custom";
  const [{ data: step }, { data: first }] = await Promise.all([
    supabase.from("setup_steps").select("phase").eq("path", path).eq("key", stepKey).maybeSingle(),
    supabase
      .from("setup_steps")
      .select("phase")
      .eq("path", path)
      .order("sort_order")
      .limit(1)
      .maybeSingle(),
  ]);
  if ((step?.phase ?? "General") !== (first?.phase ?? "General")) redirect("/portal?locked=1");
}
