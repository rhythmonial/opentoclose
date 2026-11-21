import "server-only";
import { getStripe } from "@/lib/stripe";
import { AUDIT_FEE, AUDIT_REF_PREFIX } from "@/lib/audits";

// A Stripe Checkout for an audit request's $55 (as the app's other payments
// are made), back to the thank-you page once paid. null if Stripe can't be
// reached.
export async function auditCheckoutUrl(
  request: { id: string; email: string },
  origin: string,
): Promise<string | null> {
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: request.email,
      client_reference_id: `${AUDIT_REF_PREFIX}${request.id}`,
      metadata: { kind: "audit", audit_request_id: request.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: AUDIT_FEE * 100,
            product_data: {
              name: "OTC Audit",
              description: "A recorded walkthrough and written report of your Open to Close account.",
            },
          },
        },
      ],
      success_url: `${origin}/audit/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/audit`,
    });
    return session.url;
  } catch (err) {
    console.error(`Audit checkout failed for ${request.id}:`, err);
    return null;
  }
}

// The link to send someone who requested but didn't pay: it opens a new
// checkout each time, so it doesn't expire.
export const auditPayLink = (origin: string, id: string) => `${origin}/audit/pay/${id}`;
