import { notFound } from "next/navigation";
import { cleanReport } from "@/lib/auditReport";
import { formatYmd, easternYmd } from "@/lib/audits";
import { requireStaff } from "../../staff";
import { ReportForm } from "./ReportForm";

// The tab's title, which is also the PDF's file name.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "OTC Audit Report" };
  const supabase = await requireStaff();
  const { data: r } = await supabase.from("audit_requests").select("name, team_name").eq("id", id).maybeSingle();
  return { title: r ? `OTC Audit Report - ${r.name} (${r.team_name})` : "OTC Audit Report" };
}

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

  return (
    <ReportForm
      id={r.id}
      name={r.name}
      team={r.team_name}
      auditDate={formatYmd(r.audit_date)}
      initialDelivered={r.delivered_at ? formatYmd(easternYmd(r.delivered_at)) : null}
      videoLink={r.video_link}
      initial={cleanReport(r.report)}
      initialComplete={Boolean(r.report_completed_at)}
      autoPrint={print === "1"}
    />
  );
}
