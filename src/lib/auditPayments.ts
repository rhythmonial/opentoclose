import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUDIT_REF_PREFIX } from "@/lib/audits";

// A paid OTC Audit checkout ("audit_<request id>"): its paid date and
// session are stamped (its status stays as it is). Called by the Stripe webhook and when they land
// on the thank-you page, whichever comes first.
export async function markAuditPaid(session: Stripe.Checkout.Session): Promise<string | null> {
  const ref = session.client_reference_id ?? "";
  if (!ref.startsWith(AUDIT_REF_PREFIX) || session.payment_status !== "paid") return null;
  const id = ref.slice(AUDIT_REF_PREFIX.length);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { error } = await createAdminClient()
    .from("audit_requests")
    .update({ paid_at: new Date().toISOString(), stripe_session_id: session.id })
    .eq("id", id)
    .is("paid_at", null);
  return error?.message ?? null;
}
