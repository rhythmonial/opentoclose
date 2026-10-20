"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IMPERSONATE_COOKIE } from "@/lib/impersonation";

export async function startImpersonation(formData: FormData) {
  const targetId = String(formData.get("client_id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (viewerProfile?.role !== "dev" && viewerProfile?.role !== "dev_admin") {
    redirect("/home");
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .single();

  if (
    targetProfile?.role !== "client_owner" &&
    targetProfile?.role !== "client_admin"
  ) {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, targetId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });

  redirect("/home");
}

export async function stopImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
  redirect("/dashboard");
}
