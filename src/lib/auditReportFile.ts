import "server-only";
import { cleanReport } from "@/lib/auditReport";
import { auditReportPdf } from "@/lib/auditReportPdf";
import { formatYmd } from "@/lib/audits";
import type { Tables } from "@/lib/supabase/types";

// An audit's report as a PDF response: "attachment" downloads it, "inline"
// opens it in the browser (the link clients get).
export async function auditReportResponse(
  r: Tables<"audit_requests">,
  origin: string,
  deliveredYmd: string | null,
  disposition: "attachment" | "inline",
) {
  let logo: Uint8Array | null = null;
  try {
    const res = await fetch(`${origin}/brand/logo-mark.png`);
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
      "Content-Disposition": `${disposition}; filename="${file}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// The report link to send a client: their PDF, without signing in.
export const auditReportLink = (origin: string, id: string) => `${origin}/audit/report/${id}`;
