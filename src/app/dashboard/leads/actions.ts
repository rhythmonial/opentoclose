"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addLead(formData: FormData) {
  const supabase = await createClient();

  await supabase.from("leads").insert({
    name: String(formData.get("name")),
    email: String(formData.get("email")),
    phone: String(formData.get("phone") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
    source: "manual",
  });

  revalidatePath("/dashboard/clients");
}

export async function updateLeadStatus(formData: FormData) {
  const supabase = await createClient();
  const leadId = String(formData.get("lead_id"));
  const status = String(formData.get("status"));
  const lostReason = String(formData.get("lost_reason") ?? "").trim().slice(0, 1000);
  const now = new Date().toISOString();

  // Lost files the lead under archived, with why and when.
  await supabase
    .from("leads")
    .update(
      status === "lost"
        ? { status, lost_reason: lostReason || null, lost_at: now, archived_at: now, updated_at: now }
        : // Any other status brings it back to the open leads.
          { status: status as never, lost_reason: null, lost_at: null, archived_at: null, updated_at: now },
    )
    .eq("id", leadId);

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
}

export async function updateLeadNotes(formData: FormData) {
  const supabase = await createClient();
  const leadId = String(formData.get("lead_id"));
  const notes = String(formData.get("notes") ?? "");

  await supabase
    .from("leads")
    .update({ notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  revalidatePath("/dashboard/clients");
}

export async function deleteLead(formData: FormData) {
  const supabase = await createClient();
  const leadId = String(formData.get("lead_id"));

  await supabase.from("leads").delete().eq("id", leadId);

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
}

export async function setLeadArchived(formData: FormData) {
  const supabase = await createClient();
  const leadId = String(formData.get("lead_id"));
  const archived = formData.get("archived") === "true";

  await supabase
    .from("leads")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
}
