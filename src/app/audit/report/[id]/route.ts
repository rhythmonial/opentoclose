import { createAdminClient } from "@/lib/supabase/admin";
import { easternYmd } from "@/lib/audits";
import { auditReportResponse } from "@/lib/auditReportFile";
import { siteOrigin } from "@/lib/site-origin";

// The report link sent to a client (from the Send Report email): their
// report PDF, opened in the browser without signing in, once it's marked
// complete. The link is the request's private id.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notReady = () =>
    new Response("This report isn't available yet. Please reply to your audit email and we'll help.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notReady();
  const { data: r } = await createAdminClient().from("audit_requests").select("*").eq("id", id).maybeSingle();
  if (!r || !r.report_completed_at) return notReady();
  return auditReportResponse(r, await siteOrigin(), r.delivered_at ? easternYmd(r.delivered_at) : null, "inline");
}
