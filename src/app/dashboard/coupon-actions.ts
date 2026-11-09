"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { newInviteToken } from "@/lib/coupons";
import { siteOrigin } from "@/lib/site-origin";

async function staff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "dev" && profile?.role !== "dev_admin") return null;
  return { supabase, userId: user.id };
}

export type InviteFormState = { error?: string; link?: string; note?: string } | null;

// Creates a one-time invite link: a free stretch of DIY (30 days by
// default) for whoever claims it first. The note says who it's for.
export async function createInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const me = await staff();
  if (!me) return { error: "Only staff can create invites." };

  const note = String(formData.get("note") ?? "").trim().slice(0, 120);
  if (!note) return { error: "Add who it's for (a name or email)." };
  const days = Math.trunc(Number(formData.get("free_days") || 30));
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { error: "Free days must be between 1 and 365." };
  }

  const code = newInviteToken();
  const { error } = await me.supabase.from("coupons").insert({
    code,
    free_days: days,
    max_redemptions: 1,
    is_invite: true,
    note,
    created_by: me.userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { link: `${await siteOrigin()}/invite/${code}`, note };
}

// Turns an invite link off (or back on, if it hasn't been used).
export async function setCouponActive(formData: FormData) {
  const me = await staff();
  if (!me) return;
  await me.supabase
    .from("coupons")
    .update({ active: formData.get("active") === "true" })
    .eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/dashboard");
}
