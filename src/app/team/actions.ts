"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function inviteTeammate(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/team?error=Enter+an+email+address");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "client_owner" || !profile.client_account_id) {
    redirect("/team?error=Only+the+account+owner+can+invite+teammates");
  }

  const { data: account } = await supabase
    .from("client_accounts")
    .select("name")
    .eq("id", profile.client_account_id)
    .single();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "client_admin",
      client_account_id: profile.client_account_id,
      business_name: account?.name,
    },
  });

  if (error) {
    redirect(`/team?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/team?invited=1");
}
