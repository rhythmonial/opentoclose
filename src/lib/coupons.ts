import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountSubscription } from "@/lib/billing";

// Coupon codes give a free stretch of DIY access (a free month, by
// default): no card and no subscription. When it ends they're back on Free
// and asked to subscribe. Codes are stored upper case.

export const normalizeCode = (raw: unknown) =>
  String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

type Result = { ok: true; accessEndsAt: string } | { ok: false; error: string };

// Redeems a code for the signed-in owner's account. They need to have
// filled out Initiate Your Setup (that's where the plan lives) and not
// already be on a paid plan or subscription.
export async function redeemCoupon(rawCode: unknown, userId: string): Promise<Result> {
  const code = normalizeCode(rawCode);
  if (!COUPON_CODE_PATTERN.test(code)) return { ok: false, error: "That coupon code isn't valid." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", userId)
    .single();
  if (profile?.role !== "client_owner" || !profile.client_account_id) {
    return { ok: false, error: "Only the account owner can use a coupon." };
  }
  const accountId = profile.client_account_id;

  const { data: coupon } = await admin.from("coupons").select("*").eq("code", code).maybeSingle();
  if (!coupon || !coupon.active) return { ok: false, error: "That coupon code isn't valid." };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { ok: false, error: "That coupon code has expired." };
  }
  if (coupon.max_redemptions) {
    const { count } = await admin
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id);
    if ((count ?? 0) >= coupon.max_redemptions) {
      return { ok: false, error: "That coupon code has been used up." };
    }
  }

  const [{ data: initiation }, { data: used }, { live }] = await Promise.all([
    admin.from("setup_initiation").select("engagement_type").eq("client_id", userId).maybeSingle(),
    admin
      .from("coupon_redemptions")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("client_account_id", accountId)
      .maybeSingle(),
    accountSubscription(admin, accountId),
  ]);
  if (!initiation) return { ok: false, error: "Fill out Initiate Your Setup first." };
  if (used) return { ok: false, error: "You've already used this coupon." };
  if (live || initiation.engagement_type !== "free") {
    return { ok: false, error: "Your account already has a plan, so this coupon doesn't apply." };
  }

  const accessEndsAt = new Date(Date.now() + coupon.free_days * 86400000).toISOString();
  const { error } = await admin.from("coupon_redemptions").insert({
    coupon_id: coupon.id,
    client_account_id: accountId,
    redeemed_by: userId,
    access_ends_at: accessEndsAt,
  });
  if (error) return { ok: false, error: "Couldn't apply the coupon. Please try again." };

  await admin
    .from("setup_initiation")
    .update({ engagement_type: "diy", updated_at: new Date().toISOString() })
    .eq("client_id", userId);
  return { ok: true, accessEndsAt };
}

export type FreeMonth = {
  // Free access runs until this date.
  activeUntil: string | null;
  // Their free access ended on this date and they haven't subscribed.
  endedOn: string | null;
};

// The account's coupon access. Ends any that have run out first: DIY goes
// back to Free unless they've subscribed since (or another coupon is still
// running).
export async function freeMonthStatus(accountId: string | null | undefined): Promise<FreeMonth> {
  const none = { activeUntil: null, endedOn: null };
  if (!accountId) return none;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("coupon_redemptions")
    .select("id, access_ends_at, ended_at")
    .eq("client_account_id", accountId)
    .order("access_ends_at", { ascending: false });
  if (!rows?.length) return none;

  const now = Date.now();
  const running = rows.find((r) => !r.ended_at && new Date(r.access_ends_at).getTime() > now);
  const due = rows.filter((r) => !r.ended_at && new Date(r.access_ends_at).getTime() <= now);
  const { live } = await accountSubscription(admin, accountId);

  if (due.length > 0) {
    if (!running && !live) {
      const { data: owner } = await admin
        .from("profiles")
        .select("id")
        .eq("client_account_id", accountId)
        .eq("role", "client_owner")
        .maybeSingle();
      if (owner) {
        await admin
          .from("setup_initiation")
          .update({ engagement_type: "free", updated_at: new Date().toISOString() })
          .eq("client_id", owner.id)
          .eq("engagement_type", "diy");
      }
    }
    await admin
      .from("coupon_redemptions")
      .update({ ended_at: new Date().toISOString() })
      .in(
        "id",
        due.map((r) => r.id),
      );
  }

  if (running) return { activeUntil: running.access_ends_at, endedOn: null };
  if (live) return none;
  // Only nudge them if they're actually back on Free.
  const { data: owner } = await admin
    .from("profiles")
    .select("id")
    .eq("client_account_id", accountId)
    .eq("role", "client_owner")
    .maybeSingle();
  const { data: initiation } = owner
    ? await admin.from("setup_initiation").select("engagement_type").eq("client_id", owner.id).maybeSingle()
    : { data: null };
  return {
    activeUntil: null,
    endedOn: initiation?.engagement_type === "free" ? rows[0].access_ends_at : null,
  };
}

export const freeMonthDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Invite links: a one-time coupon whose code is the secret in the link
// (/invite/<token>). The token rides along in a cookie through sign-up and
// Initiate Your Setup until the free month is claimed.
export const INVITE_COOKIE = "invite_token";

export function newInviteToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Whether an invite link can still be claimed, and for how many free days.
export async function inviteStatus(rawToken: unknown) {
  const code = normalizeCode(rawToken);
  if (!COUPON_CODE_PATTERN.test(code)) return null;
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("coupons")
    .select("id, free_days, active, expires_at, is_invite")
    .eq("code", code)
    .maybeSingle();
  if (!invite?.is_invite || !invite.active) return null;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
  const { count } = await admin
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", invite.id);
  if ((count ?? 0) > 0) return null;
  return { code, freeDays: invite.free_days };
}

export const freeDaysLabel = (days: number) =>
  days % 30 === 0
    ? `${days / 30} month${days === 30 ? "" : "s"}`
    : `${days} day${days === 1 ? "" : "s"}`;
