import { createClient } from "@/lib/supabase/server";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";
import { StaffNav } from "@/components/StaffNav";
import { TopNav } from "@/components/TopNav";

// The app's header for pages that don't draw their own (the lesson
// configurators, Initiate Your Setup): the staff nav for staff, otherwise
// the client nav (Dashboard / Setup / Resource Center), with Setup active.
export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, client_accounts(name)")
    .eq("id", user.id)
    .single();
  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  if (isStaff && !sandboxTier) return <StaffNav isDev={profile?.role === "dev"} />;
  const businessName = sandboxTier
    ? SANDBOX_LABEL[sandboxTier]
    : (profile?.client_accounts?.name ?? profile?.email ?? user.email ?? "Your business");
  return <TopNav businessName={businessName} active="setup" sandboxTier={sandboxTier} />;
}
