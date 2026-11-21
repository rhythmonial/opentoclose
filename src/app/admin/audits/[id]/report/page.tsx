import { notFound } from "next/navigation";
import { cleanReport } from "@/lib/auditReport";
import { formatYmd, reportDue, easternYmd } from "@/lib/audits";
import { requireStaff } from "../../staff";
import { ReportForm } from "./ReportForm";

// An audit's report form: a template laid out like the finished report.
// Fill in the boxes as you audit, save and come back; printing (or
// ?print=1) gives a clean PDF without the boxes.
export default async function AuditReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await requireStaff();
  const { data: r } = await supabase.from("audit_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const reportDate = r.delivered_at ? easternYmd(r.delivered_at) : reportDue(r.audit_date);

  return (
    <ReportForm
      id={r.id}
      name={r.name}
      team={r.team_name}
      auditDate={formatYmd(r.audit_date)}
      reportDate={formatYmd(reportDate)}
      videoLink={r.video_link}
      initial={cleanReport(r.report)}
      initialComplete={Boolean(r.report_completed_at)}
      autoPrint={print === "1"}
    />
  );
}
