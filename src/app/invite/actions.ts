"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INVITE_COOKIE, inviteStatus, redeemCoupon } from "@/lib/coupons";

// Holds on to an invite link while they sign up or sign in, then claims it
// once they're signed in.
export async function startInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "");
  const invite = await inviteStatus(token);
  if (!invite) redirect(`/invite/${encodeURIComponent(token)}`);

  (await cookies()).set(INVITE_COOKIE, invite.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  if (next === "signup") redirect("/signup");
  if (next === "login") redirect("/login");
  await claimInvite();
}

// Claims the invite they're holding: right away if they've filled out
// Initiate Your Setup, otherwise when they submit it (with DIY).
export async function claimInvite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jar = await cookies();
  const token = jar.get(INVITE_COOKIE)?.value;
  if (!token || !(await inviteStatus(token))) {
    jar.delete(INVITE_COOKIE);
    redirect(`/home?invite_error=${encodeURIComponent("That invite link has already been used.")}`);
  }

  const { data: initiation } = await supabase
    .from("setup_initiation")
    .select("id")
    .eq("client_id", user.id)
    .maybeSingle();
  if (!initiation) redirect("/setup?invite=1");

  const result = await redeemCoupon(token, user.id);
  jar.delete(INVITE_COOKIE);
  if (!result.ok) redirect(`/home?invite_error=${encodeURIComponent(result.error)}`);
  redirect("/portal?coupon=1");
}
