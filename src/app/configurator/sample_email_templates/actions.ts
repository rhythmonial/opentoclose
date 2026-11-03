"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { sampleFor, type EmailTemplate } from "@/lib/emailTemplates";

const STEP_KEY = "sample_email_templates";
const PAGE = `/configurator/${STEP_KEY}`;
const UUID = /^[0-9a-f-]{36}$/i;

type Result = { ok: boolean; error?: string; id?: string };

const names = (list: unknown) =>
  Array.isArray(list)
    ? [...new Set(list.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 120)))]
        .filter(Boolean)
        .slice(0, 60)
    : [];

// Saves a template: the client's copy of a sample (made the first time it
// changes) or one of their own.
export async function saveEmailTemplate(
  accountId: string | null,
  t: EmailTemplate,
): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  if (t.sampleKey && !sampleFor(t.sampleKey)) return { ok: false, error: "Unknown template." };

  const row = {
    client_account_id: account,
    include: t.include === true,
    title: String(t.title ?? "").trim().slice(0, 200) || "Untitled template",
    subject: String(t.subject ?? "").slice(0, 500),
    body: String(t.body ?? "").slice(0, 20000),
    to_roles: names(t.to),
    cc_roles: names(t.cc),
    bcc_roles: names(t.bcc),
    file_roles: names(t.files),
    updated_at: new Date().toISOString(),
  };

  if (t.sampleKey) {
    const { data, error } = await supabase
      .from("client_email_templates")
      .upsert({ ...row, sample_key: t.sampleKey }, { onConflict: "client_account_id,sample_key" })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath(PAGE);
    return { ok: true, id: data.id };
  }
  if (t.id) {
    if (!UUID.test(t.id)) return { ok: false, error: "Unknown template." };
    const { error } = await supabase
      .from("client_email_templates")
      .update(row)
      .eq("id", t.id)
      .eq("client_account_id", account);
    if (error) return { ok: false, error: error.message };
    revalidatePath(PAGE);
    return { ok: true, id: t.id };
  }
  const { data, error } = await supabase
    .from("client_email_templates")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, id: data.id };
}

// Drops the client's copy of a sample (back to the sample), or deletes one
// of their own templates.
export async function removeEmailTemplate(accountId: string | null, id: string): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account || !UUID.test(id)) return { ok: false };
  const { error } = await supabase
    .from("client_email_templates")
    .delete()
    .eq("id", id)
    .eq("client_account_id", account);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

export async function finishEmailTemplates() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}
