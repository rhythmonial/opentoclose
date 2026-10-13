"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site-origin";

export async function updateProfileInfo(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("profiles")
    .update({ name: name || null, phone: phone || null })
    .eq("id", user.id);

  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

export async function inviteClientAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/profile?error=Enter+an+email+address");
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
    redirect("/profile?error=Only+the+account+owner+can+invite+teammates");
  }

  const { data: account } = await supabase
    .from("client_accounts")
    .select("name")
    .eq("id", profile.client_account_id)
    .single();

  const origin = await siteOrigin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "client_admin",
      client_account_id: profile.client_account_id,
      business_name: account?.name,
    },
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/profile?invited=1");
}

export async function inviteStaff(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/profile?error=Enter+an+email+address");
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "dev_admin") {
    redirect("/profile?error=Only+a+dev_admin+can+invite+staff");
  }

  const origin = await siteOrigin();
  const admin = createAdminClient();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        role: "dev_admin",
        business_name: "TC Optimize (Internal)",
      },
      redirectTo: `${origin}/reset-password`,
    },
  );

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  if (invited.user) {
    await supabase.from("profile_activity_log").insert({
      profile_id: invited.user.id,
      actor_id: user.id,
      event_type: "invited",
    });
  }

  redirect("/profile?invited=1");
}
