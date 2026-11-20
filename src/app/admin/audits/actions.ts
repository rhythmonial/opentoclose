"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "./staff";
import { isAuditStatus } from "@/lib/audits";

const UUID = /^[0-9a-f-]{36}$/i;

// Saves an audit request's status, notes, report link and upsell amount.
// Moving it to paid / delivered (or past) stamps when, the first time.
export async function updateAuditRequest(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) redirect("/admin/audits");
  const supabase = await requireStaff();
  const { data: current } = await supabase
    .from("audit_requests")
    .select("paid_at, delivered_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) redirect("/admin/audits");

  const status = String(form.get("status") ?? "");
  const notes = String(form.get("notes") ?? "").trim().slice(0, 10000);
  const report = String(form.get("report_link") ?? "").trim().slice(0, 1000);
  const upsellRaw = String(form.get("upsell_amount") ?? "").replace(/[$,\s]/g, "");
  const upsell = upsellRaw === "" ? null : Number(upsellRaw);
  const back = `/admin/audits/${id}`;
  if (!isAuditStatus(status)) redirect(`${back}?error=Pick+a+status.`);
  if (upsell !== null && (!Number.isFinite(upsell) || upsell < 0)) redirect(`${back}?error=Upsell+amount+must+be+a+number.`);
  if (report && !/^https?:\/\//i.test(report)) redirect(`${back}?error=Report+link+must+start+with+http.`);

  const now = new Date().toISOString();
  const paidOrLater = ["paid", "in_progress", "delivered", "upsold"].includes(status);
  const deliveredOrLater = ["delivered", "upsold"].includes(status);
  const { error } = await supabase
    .from("audit_requests")
    .update({
      status,
      notes: notes || null,
      report_link: report || null,
      upsell_amount: upsell === null ? null : Math.round(upsell * 100) / 100,
      ...(paidOrLater && !current.paid_at ? { paid_at: now } : {}),
      ...(deliveredOrLater && !current.delivered_at ? { delivered_at: now } : {}),
      updated_at: now,
    })
    .eq("id", id);
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/audits");
  redirect(`${back}?saved=1`);
}
