// Plan prices in cents. Every plan includes the monthly access fee (a
// Stripe subscription that starts at checkout): DIY is the monthly fee
// alone; Setup is a one-time setup, with a block of staff hours, plus the
// monthly fee.
export const MONTHLY_FEE_CENTS = 11100;

// Special pricing staff can give an account (client_accounts.price_offer):
// founding members pay $499 for the setup (the monthly fee is the same);
// past clients and referrals pay $55 for their first month, then the
// regular price.
export type PriceOffer = "founding" | "first_month";
export const FOUNDING_SETUP_CENTS = 49900;
export const FIRST_MONTH_CENTS = 5500;
export const PRICE_OFFER_LABELS: Record<PriceOffer, string> = {
  founding: "Founding member ($499 setup)",
  first_month: "Past client or referral ($55 first month)",
};
export const isPriceOffer = (v: unknown): v is PriceOffer => v === "founding" || v === "first_month";

export const PLAN_PRICES = {
  // `cents` is the one-time part.
  setup: { cents: 99900, label: "Setup", hours: 10 },
  diy: { cents: 0, label: "DIY", hours: 0 },
} as const;

export type PlanKind = keyof typeof PLAN_PRICES;

export const DEFAULT_HOURLY_RATE = 125;

// The 10-hour setup bundle (the Setup plan's one-time part), also sold on
// its own for more hours.
export const HOUR_BUNDLE = { hours: 10, cents: 99900 } as const;
export const MAX_HOURLY_PURCHASE = 40;

export function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export const MONTHLY_FEE_LABEL = `${formatDollars(MONTHLY_FEE_CENTS)}/mo`;

// "$111/mo" for DIY, "$999 + $111/mo" for Setup.
export function planPriceLabel(plan: PlanKind) {
  const once = PLAN_PRICES[plan].cents;
  return once > 0 ? `${formatDollars(once)} + ${MONTHLY_FEE_LABEL}` : MONTHLY_FEE_LABEL;
}

// The engagement types' names with their prices.
export const ENGAGEMENT_LABELS: Record<string, string> = {
  free: "Free",
  diy: `DIY (${planPriceLabel("diy")})`,
  custom: `Setup (${planPriceLabel("setup")})`,
};

export function stepPriceCents(hours: number, hourlyRate: number) {
  return Math.round(hours * hourlyRate * 100);
}
