"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "./staff";
import { DELIVERED_OR_LATER, isAuditStatus, isYmd, PAID_OR_LATER, ymdToTimestamp } from "@/lib/audits";

const UUID = /^[0-9a-f-]{36}$/i;
const isLink = (v: string) => /^https?:\/\//i.test(v);

function refresh(id: string) {
  revalidatePath("/admin/audits");
  revalidatePath(`/admin/audits/${id}`);
  revalidatePath("/dashboard/clients");
}

// Saves an audit request from its page: status, audit date, delivered
// date, video and report links, upsell amount and notes. Moving it to paid
// (or later) stamps the paid date; to delivered or upsold with no
// delivered date picked, today.
export async function updateAuditRequest(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) redirect("/admin/audits");
  const supabase = await requireStaff();
  const { data: current } = await supabase.from("audit_requests").select("paid_at").eq("id", id).maybeSingle();
  if (!current) redirect("/admin/audits");

  const status = String(form.get("status") ?? "");
  const auditDate = String(form.get("audit_date") ?? "").trim();
  const deliveredDate = String(form.get("delivered_date") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 10000);
  const video = String(form.get("video_link") ?? "").trim().slice(0, 1000);
  const report = String(form.get("report_link") ?? "").trim().slice(0, 1000);
  const upsellRaw = String(form.get("upsell_amount") ?? "").replace(/[$,\s]/g, "");
  const upsell = upsellRaw === "" ? null : Number(upsellRaw);
  const back = `/admin/audits/${id}`;
  if (!isAuditStatus(status)) redirect(`${back}?error=Pick+a+status.`);
  if (auditDate && !isYmd(auditDate)) redirect(`${back}?error=Pick+a+valid+audit+date.`);
  if (deliveredDate && !isYmd(deliveredDate)) redirect(`${back}?error=Pick+a+valid+delivered+date.`);
  if (upsell !== null && (!Number.isFinite(upsell) || upsell < 0)) redirect(`${back}?error=Upsell+amount+must+be+a+number.`);
  if (video && !isLink(video)) redirect(`${back}?error=Video+link+must+start+with+http.`);
  if (report && !isLink(report)) redirect(`${back}?error=Report+link+must+start+with+http.`);

  const now = new Date().toISOString();
  const deliveredAt = deliveredDate
    ? ymdToTimestamp(deliveredDate)
    : DELIVERED_OR_LATER.includes(status)
      ? now
      : null;
  const { error } = await supabase
    .from("audit_requests")
    .update({
      status,
      audit_date: auditDate || null,
      delivered_at: deliveredAt,
      notes: notes || null,
      video_link: video || null,
      report_link: report || null,
      upsell_amount: upsell === null ? null : Math.round(upsell * 100) / 100,
      ...(PAID_OR_LATER.includes(status) && !current.paid_at ? { paid_at: now } : {}),
      updated_at: now,
    })
    .eq("id", id);
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  refresh(id);
  redirect(`${back}?saved=1`);
}

// From the Clients page table: a request's status or audit date, saved as
// it's picked.
export async function quickUpdateAudit(
  id: string,
  patch: { status?: string; audit_date?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Unknown request." };
  const supabase = await requireStaff();
  const { data: current } = await supabase
    .from("audit_requests")
    .select("paid_at, delivered_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { ok: false, error: "Unknown request." };
  const now = new Date().toISOString();
  const update: {
    status?: string;
    audit_date?: string | null;
    paid_at?: string;
    delivered_at?: string;
    updated_at: string;
  } = { updated_at: now };
  if (patch.status !== undefined) {
    if (!isAuditStatus(patch.status)) return { ok: false, error: "Pick a status." };
    update.status = patch.status;
    if (PAID_OR_LATER.includes(patch.status) && !current.paid_at) update.paid_at = now;
    if (DELIVERED_OR_LATER.includes(patch.status) && !current.delivered_at) update.delivered_at = now;
  }
  if (patch.audit_date !== undefined) {
    if (patch.audit_date && !isYmd(patch.audit_date)) return { ok: false, error: "Pick a valid date." };
    update.audit_date = patch.audit_date || null;
  }
  const { error } = await supabase.from("audit_requests").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}
