import { notFound } from "next/navigation";
import { requireStaff } from "../../../staff";
import { cleanReport } from "@/lib/auditReport";
import { auditReportPdf } from "@/lib/auditReportPdf";
import { easternYmd, formatYmd } from "@/lib/audits";
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

  let logo: Uint8Array | null = null;
  try {
    const res = await fetch(`${await siteOrigin()}/brand/logo-mark.png`);
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {}

  const pdf = await auditReportPdf({
    name: r.name,
    team: r.team_name,
    auditDate: formatYmd(r.audit_date),
    delivered: formatYmd(deliveredYmd),
    videoLink: r.video_link,
    report: cleanReport(r.report),
    logo,
  });
  const file = `OTC Audit Report - ${r.name} (${r.team_name})`.replace(/[^\w ().-]+/g, "").slice(0, 120);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
