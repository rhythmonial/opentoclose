"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SANDBOX_COOKIE, type SandboxTier } from "@/lib/devSandbox";

async function requireStaff() {
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

  if (profile?.role !== "dev" && profile?.role !== "dev_admin") {
    redirect("/home");
  }

  return supabase;
}

export async function startSandbox(formData: FormData) {
  const tier = String(formData.get("tier") ?? "");

  if (tier !== "custom" && tier !== "diy" && tier !== "free") {
    redirect("/dashboard");
  }

  await requireStaff();

  const cookieStore = await cookies();
  cookieStore.set(SANDBOX_COOKIE, tier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/home");
}

export async function stopSandbox() {
  const cookieStore = await cookies();
  cookieStore.delete(SANDBOX_COOKIE);
  redirect("/dashboard");
}

export async function resetSandbox(formData: FormData) {
  const tier = String(formData.get("tier") ?? "") as SandboxTier;
  const supabase = await requireStaff();

  await supabase.from("dev_sandbox_step_status").delete().eq("tier", tier);

  revalidatePath("/home");
  revalidatePath("/portal");
  revalidatePath("/lesson", "layout");
}
