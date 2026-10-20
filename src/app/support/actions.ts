"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, SUPPORT_INBOX } from "@/lib/email";
import { siteOrigin } from "@/lib/site-origin";

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
}

export async function createTicket(formData: FormData) {
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const stepId = String(formData.get("step_id") ?? "") || null;

  const { supabase, userId, isStaff } = await getActor();
  if (isStaff) redirect("/dashboard");

  if (!subject || !message) {
    redirect("/support?error=Please+add+a+subject+and+your+question.");
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ client_id: userId, subject, step_id: stepId })
    .select("id")
    .single();

  if (error || !ticket) {
    redirect("/support?error=Something+went+wrong.+Please+try+again.");
  }

  await supabase
    .from("support_messages")
    .insert({ ticket_id: ticket.id, author_id: userId, body: message });

  const client = await clientLabel(supabase, userId);
  await sendEmail({
    to: SUPPORT_INBOX,
    subject: `New support question: ${subject}`,
    heading: `${client.label} asked a question`,
    body: message,
    ctaLabel: "Open the support center",
    ctaUrl: `${await siteOrigin()}/dashboard`,
  });

  revalidate();
  redirect("/support?sent=1");
}

export async function replyToTicket(formData: FormData) {
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const { supabase, userId, isStaff } = await getActor();

  await supabase
    .from("support_messages")
    .insert({ ticket_id: ticketId, author_id: userId, body });

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
        body,
        ctaLabel: "View your question",
        ctaUrl: `${origin}/support`,
      });
    } else if (!isStaff) {
      await sendEmail({
        to: SUPPORT_INBOX,
        subject: `New reply: ${ticket.subject}`,
        heading: `${client.label} replied`,
        body,
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
