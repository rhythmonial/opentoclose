import {
  cancelComplimentaryPlan,
  cancelSubscription,
  openBillingPortal,
  resumeSubscription,
} from "@/app/profile/billing-actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { startPlanCheckout } from "@/app/checkout/actions";
import {
  ENGAGEMENT_LABELS,
  formatDollars,
  MONTHLY_FEE_CENTS,
} from "@/lib/pricing";
import type { Database } from "@/lib/supabase/types";

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
type Payment = Pick<
  Database["public"]["Tables"]["payments"]["Row"],
  "id" | "kind" | "amount_cents" | "created_at"
>;

const PAYMENT_LABELS: Record<string, string> = {
  setup: "Setup",
  diy: "DIY",
  step: "Done-for-you step",
  monthly: "Monthly access",
  hours: "Setup hours",
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// The client's plan and monthly access fee: its status and next charge,
// and (for the account owner) cancel / keep, and Stripe's billing portal
// for the card on file and invoices.
export function BillingSection({
  plan,
  subscription,
  payments,
  isOwner,
  complimentary = false,
  freeMonth = { activeUntil: null, endedOn: null },
  notice,
  error,
}: {
  plan: string | null;
  // The latest subscription (live or not).
  subscription: Subscription | null;
  payments: Payment[];
  isOwner: boolean;
  // A paid plan given at no charge (no Stripe subscription ever).
  complimentary?: boolean;
  // A coupon's free month: running until, or ended on (not subscribed).
  freeMonth?: { activeUntil: string | null; endedOn: string | null };
  notice?: string;
  error?: string;
}) {
  const live =
    subscription && ["active", "trialing", "past_due"].includes(subscription.status)
      ? subscription
      : null;
  const amount = formatDollars(live?.amount_cents ?? MONTHLY_FEE_CENTS);
  const ends = live?.current_period_end ? day(live.current_period_end) : null;
  const button =
    "rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent";

  return (
    <section id="billing" className="scroll-mt-6 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-ink">Billing</h2>
        {isOwner && !live && !complimentary && (
          <form action={startPlanCheckout}>
            <input type="hidden" name="plan" value="diy" />
            <input type="hidden" name="return_to" value="/profile" />
            <button
              type="submit"
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Subscribe
            </button>
          </form>
        )}
      </div>

      {notice && (
        <div className="mt-3 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-ink-soft">Plan</dt>
        <dd className="font-semibold text-ink">{ENGAGEMENT_LABELS[plan ?? "free"] ?? "Free"}</dd>
        <dt className="text-ink-soft">Monthly access</dt>
        <dd className="text-ink">
          {live ? (
            live.status === "past_due" ? (
              <span className="font-semibold text-danger">
                {amount}/month &middot; payment failed. The card on file needs updating.
              </span>
            ) : live.cancel_at_period_end ? (
              <span className="font-semibold text-warning">Your subscription is cancelled.</span>
            ) : (
              <span>
                {amount}/month &middot; active, renews automatically
                {ends ? ` on ${ends}` : " each month"}
              </span>
            )
          ) : freeMonth.activeUntil ? (
            <span>
              Free month (coupon) &middot; ends {day(freeMonth.activeUntil)}
            </span>
          ) : freeMonth.endedOn ? (
            <span className="font-semibold text-warning">
              Your free month ended {day(freeMonth.endedOn)}. Subscribe to keep your DIY access.
            </span>
          ) : complimentary ? (
            <span>Included at no charge</span>
          ) : subscription?.status === "canceled" ? (
            <span className="text-ink-soft">
              Ended{subscription.current_period_end ? ` ${day(subscription.current_period_end)}` : ""}
            </span>
          ) : (
            <span className="text-ink-soft">Not subscribed</span>
          )}
        </dd>
      </dl>

      {isOwner ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {live && !live.cancel_at_period_end && (
            <form action={cancelSubscription}>
              <button type="submit" className={`${button} hover:!border-danger hover:!text-danger`}>
                Cancel subscription
              </button>
            </form>
          )}
          {complimentary && (
            <form action={cancelComplimentaryPlan}>
              <ConfirmSubmitButton
                confirmMessage={
                  plan === "diy"
                    ? "Cancel your DIY plan? Your account goes back to Free right away."
                    : "Cancel your plan?"
                }
                className={`${button} hover:!border-danger hover:!text-danger`}
              >
                Cancel subscription
              </ConfirmSubmitButton>
            </form>
          )}
          {live?.cancel_at_period_end && (
            <form action={resumeSubscription}>
              <button
                type="submit"
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white"
              >
                Keep my subscription
              </button>
            </form>
          )}
          {subscription && (
            <form action={openBillingPortal}>
              <button type="submit" className={button}>
                Payment method &amp; invoices
              </button>
            </form>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-faint">Only the account owner can change billing.</p>
      )}
      {live && !live.cancel_at_period_end && isOwner && (
        <p className="mt-2 text-xs text-ink-faint">
          Your plan renews automatically every month until you cancel. Canceling stops the
          next charge, and you keep access until the end of the month you&rsquo;ve paid for.
        </p>
      )}
      {freeMonth.activeUntil && isOwner && (
        <p className="mt-2 text-xs text-ink-faint">
          Subscribe any time to keep DIY after your free month. Billing starts when it ends.
        </p>
      )}

      {payments.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">Payments</h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-ink">{PAYMENT_LABELS[p.kind] ?? p.kind}</span>
                <span className="text-ink-soft">
                  {formatDollars(p.amount_cents)} &middot; {day(p.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
