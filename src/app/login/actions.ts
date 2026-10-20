"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { IMPERSONATE_COOKIE } from "@/lib/impersonation";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  await supabase.from("profile_activity_log").insert({
    profile_id: data.user.id,
    actor_id: data.user.id,
    event_type: "sign_in",
  });

  if (profile?.role === "dev" || profile?.role === "dev_admin") {
    redirect("/dashboard");
  }

  redirect("/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(IMPERSONATE_COOKIE);
  redirect("/login");
}
