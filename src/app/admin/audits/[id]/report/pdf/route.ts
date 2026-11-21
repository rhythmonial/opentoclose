import { notFound } from "next/navigation";
import { requireStaff } from "../../../staff";
import { easternYmd } from "@/lib/audits";
import { auditReportResponse } from "@/lib/auditReportFile";
import { siteOrigin } from "@/lib/site-origin";
import { markReportDelivered } from "../../../actions";

// Downloads an audit's report as a PDF. Downloading delivers it: today
// becomes its delivered date (unless it already has one).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await requireStaff();
  const { data: r } = await supabase.from("audit_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const marked = await markReportDelivered(id);
  const deliveredYmd = marked.delivered ?? (r.delivered_at ? easternYmd(r.delivered_at) : null);
  return auditReportResponse(r, await siteOrigin(), deliveredYmd, "attachment");
}
