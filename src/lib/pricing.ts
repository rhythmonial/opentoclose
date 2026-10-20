// Plan prices in cents. Setup includes a block of staff hours.
export const PLAN_PRICES = {
  setup: { cents: 99900, label: "Setup", hours: 10 },
  diy: { cents: 1900, label: "DIY", hours: 0 },
} as const;

export type PlanKind = keyof typeof PLAN_PRICES;

export const DEFAULT_HOURLY_RATE = 100;

export function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function stepPriceCents(hours: number, hourlyRate: number) {
  return Math.round(hours * hourlyRate * 100);
}
