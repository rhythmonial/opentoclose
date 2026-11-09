"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, SUPPORT_INBOX } from "@/lib/email";
import { siteOrigin } from "@/lib/site-origin";
import { cleanAttachments, type Attachment } from "@/lib/supportAttachments";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDelegable } from "@/lib/stepOwnership";

const UUID = /^[0-9a-f-]{36}$/i;

// Emails mention attached files, since the files themselves stay private.
function withAttachmentNote(body: string, attachments: Attachment[]) {
  if (attachments.length === 0) return body;
  const note = `(${attachments.length} image/video attachment${attachments.length === 1 ? "" : "s"})`;
  return body ? `${body}\n\n${note}` : note;
}

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  return { supabase, userId: user.id, isStaff };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function clientLabel(supabase: Supabase, clientId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("email, client_accounts(name)")
    .eq("id", clientId)
    .single();
  return {
    email: data?.email ?? null,
    label: data?.client_accounts?.name ?? data?.email ?? "A client",
  };
}

function revalidate() {
  revalidatePath("/support");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients", "layout");
}

export async function createTicket(formData: FormData) {
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const message = String(formData.get("message") ?? "").trim();
  const rawStep = String(formData.get("step_id") ?? "");
  const stepId = UUID.test(rawStep) ? rawStep : null;
  // Back to the lesson or setup checklist it was asked from, else the
  // support page.
  const asked = String(formData.get("return_to") ?? "");
  const back =
    /^\/lesson\/[0-9a-f-]{36}$/i.test(asked) || asked === "/portal" ? asked : "/support";
  const fail = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const { supabase, userId, isStaff } = await getActor();
  if (isStaff) redirect("/dashboard");
  const attachments = cleanAttachments(formData.get("attachments"), userId);

  if (!subject || !message) {
    fail("Please add a subject and your question.");
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ client_id: userId, subject, step_id: stepId })
    .select("id")
    .single();

  if (error || !ticket) {
    fail("Something went wrong. Please try again.");
    return;
  }

  await supabase
    .from("support_messages")
    .insert({ ticket_id: ticket.id, author_id: userId, body: message, attachments });

  const client = await clientLabel(supabase, userId);
  await sendEmail({
    to: SUPPORT_INBOX,
    subject: `New support question: ${subject}`,
    heading: `${client.label} asked a question`,
    body: withAttachmentNote(message, attachments),
    ctaLabel: "Open the support center",
    ctaUrl: `${await siteOrigin()}/dashboard/clients`,
  });

  revalidate();
  redirect(back === "/support" ? "/support?sent=1" : `${back}?asked=1`);
}

export async function replyToTicket(formData: FormData) {
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  const { supabase, userId, isStaff } = await getActor();
  const attachments = cleanAttachments(formData.get("attachments"), userId);
  if (!body && attachments.length === 0) return;

  await supabase
    .from("support_messages")
    .insert({ ticket_id: ticketId, author_id: userId, body, attachments });

  // A staff reply hands the ticket back to the client; a client reply
  // (including on a resolved ticket) puts it back in the staff queue.
  await supabase
    .from("support_tickets")
    .update({
      status: isStaff ? "answered" : "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("subject, client_id")
    .eq("id", ticketId)
    .single();

  if (ticket) {
    const client = await clientLabel(supabase, ticket.client_id);
    const origin = await siteOrigin();

    if (isStaff && client.email) {
      await sendEmail({
        to: client.email,
        subject: `Re: ${ticket.subject}`,
        heading: "Josie’s team replied to your question",
        body: withAttachmentNote(body, attachments),
        ctaLabel: "View your question",
        ctaUrl: `${origin}/support`,
      });
    } else if (!isStaff) {
      await sendEmail({
        to: SUPPORT_INBOX,
        subject: `New reply: ${ticket.subject}`,
        heading: `${client.label} replied`,
        body: withAttachmentNote(body, attachments),
        ctaLabel: "Open the support center",
        ctaUrl: `${origin}/dashboard`,
      });
    }
  }

  revalidate();
}

export async function resolveTicket(formData: FormData) {
  const ticketId = String(formData.get("ticket_id") ?? "");

  const { supabase } = await getActor();

  await supabase
    .from("support_tickets")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  revalidate();
}

// A DIY or Setup client asks our team to set up a lesson our team handles
// (marked S), using their setup hours. It's recorded as a set up request:
// staff get a notification, the lesson gets a star, and the client can move
// on. One open request per lesson.
export async function requestStepSetup(formData: FormData) {
  const stepId = String(formData.get("step_id") ?? "");
  const { supabase, userId, isStaff } = await getActor();
  if (isStaff) redirect("/dashboard");
  const back = `/lesson/${stepId}`;
  const fail = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const { data: step } = await supabase
    .from("setup_steps")
    .select("id, title, completed_by")
    .eq("id", stepId)
    .maybeSingle();
  if (!step || step.completed_by !== "staff") {
    fail("This lesson can't be requested.");
    return;
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", userId)
    .single();
  const accountId = me?.client_account_id;
  if (!accountId) {
    fail("Couldn't find your account.");
    return;
  }

  // Needs a paid plan and setup hours left (read with the service role,
  // since members only see their own logged hours).
  const admin = createAdminClient();
  const [{ data: account }, { data: members }] = await Promise.all([
    admin.from("client_accounts").select("hours_purchased").eq("id", accountId).single(),
    admin.from("profiles").select("id, role").eq("client_account_id", accountId),
  ]);
  const ownerId = (members ?? []).find((m) => m.role === "client_owner")?.id ?? userId;
  const ids = (members ?? []).map((m) => m.id);
  const [{ data: initiation }, { data: log }] = await Promise.all([
    admin.from("setup_initiation").select("engagement_type").eq("client_id", ownerId).maybeSingle(),
    ids.length
      ? admin.from("hours_log").select("hours").in("client_id", ids)
      : Promise.resolve({ data: [] as { hours: number }[] }),
  ]);
  if (!isDelegable(step.completed_by, initiation?.engagement_type)) {
    fail("Set up requests come with the DIY and Setup plans.");
    return;
  }
  const used = (log ?? []).reduce((sum, h) => sum + Number(h.hours), 0);
  if (Number(account?.hours_purchased ?? 0) - used <= 0) {
    fail("You're out of setup hours. Add more hours to request a set up.");
    return;
  }

  const { data: existing } = await supabase
    .from("setup_requests")
    .select("id")
    .eq("client_account_id", accountId)
    .eq("step_id", step.id)
    .is("done_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`${back}?requested=1`);

  const { error } = await supabase
    .from("setup_requests")
    .insert({ client_account_id: accountId, step_id: step.id, requested_by: userId });
  if (error) {
    fail("Couldn't send your request. Please try again.");
    return;
  }

  const client = await clientLabel(supabase, userId);
  await sendEmail({
    to: SUPPORT_INBOX,
    subject: `Set up request: ${step.title}`,
    heading: `${client.label} requested a set up`,
    body: `Please set up "${step.title}" for ${client.label} using their setup hours.`,
    ctaLabel: "Open their client page",
    ctaUrl: `${await siteOrigin()}/dashboard/clients/${accountId}`,
  });

  revalidate();
  revalidatePath("/portal");
  redirect(`${back}?requested=1`);
}
