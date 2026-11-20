import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUDIT_REF_PREFIX } from "@/lib/audits";

// A paid OTC Audit checkout ("audit_<request id>"): the request is marked
// paid, unless it's already been moved past requested, and its paid date
// and session are stamped. Called by the Stripe webhook and when they land
// on the thank-you page, whichever comes first.
export async function markAuditPaid(session: Stripe.Checkout.Session): Promise<string | null> {
  const ref = session.client_reference_id ?? "";
  if (!ref.startsWith(AUDIT_REF_PREFIX) || session.payment_status !== "paid") return null;
  const id = ref.slice(AUDIT_REF_PREFIX.length);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("audit_requests")
    .update({ status: "paid", updated_at: now })
    .eq("id", id)
    .eq("status", "requested");
  if (error) return error.message;
  const { error: stampError } = await admin
    .from("audit_requests")
    .update({ paid_at: now, stripe_session_id: session.id })
    .eq("id", id)
    .is("paid_at", null);
  return stampError?.message ?? null;
}
