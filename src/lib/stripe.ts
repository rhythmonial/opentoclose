import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Payments aren't set up yet (STRIPE_SECRET_KEY is missing).");
  }
  client ??= new Stripe(key);
  return client;
}
