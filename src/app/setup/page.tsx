import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  daysUntil,
  freeDaysLabel,
  freeMonthStatus,
  INVITE_COOKIE,
  inviteStatus,
} from "@/lib/coupons";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MissingFieldsNotice } from "@/components/MissingFieldsNotice";
import { SetupDetailsFields } from "@/components/SetupDetailsFields";
import { submitSetupInitiation } from "./actions";
import { getSandboxTier } from "@/lib/devSandbox";
import { progressOwnerId } from "@/lib/accountOwner";

export default async function SetupInitiationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string; tested?: string }>;
}) {
  const { error, plan, tested } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Teammates share the owner's progress, setup form and plan.
  const accountUserId = await progressOwnerId(supabase, user.id);

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, client_account_id")
      .eq("id", user.id)
      .single(),
    supabase
      .from("setup_initiation")
      .select("*")
      .eq("client_id", accountUserId)
      .maybeSingle(),
  ]);

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;

  const { data: account } = profile?.client_account_id
    ? await supabase
        .from("client_accounts")
        .select("name")
        .eq("id", profile.client_account_id)
        .single()
    : { data: null };

  const isUpdate = Boolean(existing);
  const paidPlan = existing?.engagement_type ?? "free";
  const defaultEngagementType: "diy" | "custom" =
    paidPlan === "custom" || paidPlan === "diy"
      ? paidPlan
      : plan === "setup" || plan === "custom"
        ? "custom"
        : "diy";
  const hasPaidPlan = paidPlan === "custom" || paidPlan === "diy";
  // An invite link they're holding (DIY free for its days, no payment), or
  // the free time they're already in.
  const invite = hasPaidPlan ? null : await inviteStatus((await cookies()).get(INVITE_COOKIE)?.value);
  const freeMonth = isStaff
    ? { activeUntil: null, endedOn: null }
    : await freeMonthStatus(profile?.client_account_id);
  const daysLeft = freeMonth.activeUntil ? daysUntil(freeMonth.activeUntil) : 0;
  const freeOffer = invite
    ? { label: freeDaysLabel(invite.freeDays), started: false }
    : freeMonth.activeUntil
      ? { label: `${daysLeft} day${daysLeft === 1 ? "" : "s"}`, started: true }
      : null;

  return (
    <main className="flex flex-1 items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link
          href={isStaff ? (sandboxTier ? "/portal" : "/dashboard/tasks") : "/home"}
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {isStaff
            ? sandboxTier
              ? "Back to your setup"
              : "Back to editor"
            : "Back to your dashboard"}
        </Link>

        {isStaff && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Test mode &mdash; fill this out and submit to try it. Nothing is
            saved and there&rsquo;s no checkout.
          </div>
        )}

        {isStaff && tested && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
            Test submission received. A real client would now go to checkout
            for {tested === "diy" ? "DIY ($111/mo)" : "Setup ($1,111 + $111/mo)"}
            {sandboxTier ? ", and this step is marked complete in your sandbox." : "."}
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {hasPaidPlan ? "Your setup details" : "Choose your plan"}
        </h1>

        {error && (
          <div className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form
          action={submitSetupInitiation}
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
        <fieldset className="contents">
          <SetupDetailsFields
            existing={existing}
            accountName={account?.name ?? ""}
            email={user.email ?? ""}
            defaultEngagementType={invite ? "diy" : defaultEngagementType}
            freeOffer={freeOffer}
          />

          <MissingFieldsNotice />
          <button
            type="submit"
            className="mt-2 justify-self-center rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            {freeOffer
              ? "Submit"
              : hasPaidPlan
                ? isUpdate
                  ? "Save Changes"
                  : "Submit"
                : "Continue to Payment"}
          </button>
        </fieldset>
        </form>
      </div>
    </main>
  );
}
