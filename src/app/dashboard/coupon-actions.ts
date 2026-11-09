"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COUPON_CODE_PATTERN, normalizeCode } from "@/lib/coupons";

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

export type CouponFormState = { error?: string; created?: string } | null;

// Creates a coupon code: a free stretch of DIY access (30 days by default),
// optionally limited in uses or by an end date.
export async function createCoupon(
  _prev: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  const me = await staff();
  if (!me) return { error: "Only staff can create coupons." };

  const code = normalizeCode(formData.get("code"));
  if (!COUPON_CODE_PATTERN.test(code)) {
    return { error: "Codes are 3 to 40 letters, numbers, dashes or underscores." };
  }
  const days = Math.trunc(Number(formData.get("free_days") || 30));
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { error: "Free days must be between 1 and 365." };
  }
  const rawMax = String(formData.get("max_redemptions") ?? "").trim();
  const max = rawMax ? Math.trunc(Number(rawMax)) : null;
  if (max !== null && (!Number.isFinite(max) || max < 1)) {
    return { error: "Max uses must be 1 or more (or blank for no limit)." };
  }
  const rawExpires = String(formData.get("expires_on") ?? "").trim();
  // Good through the end of that day.
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(rawExpires)
    ? new Date(`${rawExpires}T23:59:59`).toISOString()
    : null;

  const { error } = await me.supabase.from("coupons").insert({
    code,
    free_days: days,
    max_redemptions: max,
    expires_at: expiresAt,
    created_by: me.userId,
  });
  if (error) {
    return { error: error.code === "23505" ? "That code already exists." : error.message };
  }
  revalidatePath("/dashboard");
  return { created: code };
}

// Turns a coupon on or off (off codes can't be redeemed).
export async function setCouponActive(formData: FormData) {
  const me = await staff();
  if (!me) return;
  await me.supabase
    .from("coupons")
    .update({ active: formData.get("active") === "true" })
    .eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/dashboard");
}
