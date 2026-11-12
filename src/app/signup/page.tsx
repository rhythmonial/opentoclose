import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_COOKIE, freeDaysLabel, inviteStatus } from "@/lib/coupons";
import { signUp } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";
import { SetupDetailsFields } from "@/components/SetupDetailsFields";
import { MissingFieldsNotice } from "@/components/MissingFieldsNotice";

// Sign-up is the setup details form (business, states, tools, decision
// maker, plan) plus a password, then straight to payment.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string }>;
}) {
  const { error, plan } = await searchParams;
  // Not open yet: only someone with an invite link signs up; everyone else
  // goes to the founding members page.
  const token = (await cookies()).get(INVITE_COOKIE)?.value;
  if (!token) redirect("/");
  const invite = await inviteStatus(token);
  const freeOffer = invite ? { label: freeDaysLabel(invite.freeDays), started: false } : null;

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-2xl">
        <h1 className="font-display text-2xl font-bold text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Tell us about your business and choose your plan.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form action={signUp} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="contents">
            <SetupDetailsFields
              existing={null}
              accountName=""
              email=""
              defaultEngagementType={!freeOffer && (plan === "setup" || plan === "custom") ? "custom" : "diy"}
              freeOffer={freeOffer}
              afterOwner={
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Password</span>
                  <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
                </label>
              }
            />
            <MissingFieldsNotice />
            <button
              type="submit"
              className="mt-2 justify-self-center rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            >
              {freeOffer ? "Create account" : "Continue to Payment"}
            </button>
          </fieldset>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
