import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditCheckoutUrl } from "@/lib/auditCheckout";
import { siteOrigin } from "@/lib/site-origin";

// A payment link sent to someone who requested an audit but didn't pay:
// a fresh Stripe Checkout for their request (or the thank-you page if it's
// already paid).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = await siteOrigin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(`${origin}/audit`);
  const { data: row } = await createAdminClient()
    .from("audit_requests")
    .select("id, email, paid_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.redirect(`${origin}/audit`);
  if (row.paid_at) return NextResponse.redirect(`${origin}/audit/thanks`);
  const url = await auditCheckoutUrl(row, origin);
  return NextResponse.redirect(url ?? `${origin}/audit?error=${encodeURIComponent("Payment couldn't be opened. Please text 813-906-6019 and we'll help.")}`);
}
