import { startHoursCheckout } from "@/app/checkout/actions";
import { formatDollars, HOUR_BUNDLE, MAX_HOURLY_PURCHASE } from "@/lib/pricing";

type Purchase = {
  id: string;
  kind: string;
  hours: number | null;
  amount_cents: number;
  created_at: string;
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const hrs = (n: number) => `${Number(n.toFixed(2))} hr${n === 1 ? "" : "s"}`;

// What an hour purchase was.
function purchaseLabel(p: Purchase) {
  const h = Number(p.hours ?? 0);
  if (p.kind === "setup") return `Setup plan (${h}-hour bundle)`;
  if (p.kind === "step") return `Done-for-you step (${hrs(h)})`;
  if (h === HOUR_BUNDLE.hours && p.amount_cents === HOUR_BUNDLE.cents) return `${h}-hour bundle`;
  return `${hrs(h)} by the hour`;
}

// The account's setup hours: bought (the Setup bundle, hours bought by the
// hour or as bundles, done-for-you steps), used (logged by the team), and
// left, with a way for the owner to buy more.
export function HoursSection({
  purchased,
  used,
  purchases,
  hourlyRate,
  isOwner,
  notice,
  error,
}: {
  purchased: number;
  used: number;
  purchases: Purchase[];
  hourlyRate: number;
  isOwner: boolean;
  notice?: string;
  error?: string;
}) {
  const left = purchased - used;
  const pct = purchased > 0 ? Math.min(100, (used / purchased) * 100) : 0;
  const bundlePerHour = formatDollars(Math.round(HOUR_BUNDLE.cents / HOUR_BUNDLE.hours));

  return (
    <section id="hours" className="scroll-mt-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[15px] font-bold text-ink">Setup hours</h2>

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

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        {[
          ["Purchased", hrs(purchased)],
          ["Used", hrs(used)],
          ["Remaining", hrs(Math.max(0, left))],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-bg px-3 py-2.5">
            <div className="text-xs text-ink-soft">{label}</div>
            <div
              className={`font-display text-lg font-bold ${
                label === "Remaining" && left <= 0 && purchased > 0 ? "text-danger" : "text-ink"
              }`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
      {purchased > 0 && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-soft" aria-hidden>
          <div
            className={`h-full rounded-full ${left <= 0 ? "bg-danger" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {left < 0 && (
        <p className="mt-2 text-xs text-danger">
          {hrs(-left)} over your purchased hours. Buy more to cover them.
        </p>
      )}

      {isOwner ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <form action={startHoursCheckout} className="flex flex-col gap-2 rounded-lg border border-border p-3.5">
            <input type="hidden" name="option" value="bundle" />
            <span className="text-sm font-semibold text-ink">
              {HOUR_BUNDLE.hours}-hour bundle
            </span>
            <span className="text-xs text-ink-soft">
              {formatDollars(HOUR_BUNDLE.cents)} &middot; {bundlePerHour}/hr
            </span>
            <button
              type="submit"
              className="mt-auto self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white"
            >
              Buy bundle ({formatDollars(HOUR_BUNDLE.cents)})
            </button>
          </form>
          <form action={startHoursCheckout} className="flex flex-col gap-2 rounded-lg border border-border p-3.5">
            <input type="hidden" name="option" value="hourly" />
            <span className="text-sm font-semibold text-ink">By the hour</span>
            <span className="text-xs text-ink-soft">{formatDollars(hourlyRate * 100)}/hr</span>
            <span className="mt-auto flex items-center gap-2">
              <input
                type="number"
                name="hours"
                min={1}
                max={MAX_HOURLY_PURCHASE}
                defaultValue={1}
                required
                aria-label="Hours to buy"
                className="w-16 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
              />
              <span className="text-sm text-ink-soft">hrs</span>
              <button
                type="submit"
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Buy hours
              </button>
            </span>
          </form>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-faint">Only the account owner can buy hours.</p>
      )}

      {purchases.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
            Hours purchased
          </h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {purchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-ink">{purchaseLabel(p)}</span>
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
