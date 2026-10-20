import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";
import {
  SupportStatusBadge,
  SupportThread,
  type SupportMessage,
} from "@/components/SupportThread";
import { createTicket } from "./actions";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; sent?: string; error?: string }>;
}) {
  const { step: stepParam, sent, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_accounts(name)")
    .eq("id", user.id)
    .single();

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;

  if (isStaff && !sandboxTier) {
    redirect("/dashboard");
  }

  const [{ data: step }, { data: tickets }] = await Promise.all([
    stepParam
      ? supabase
          .from("setup_steps")
          .select("id, title")
          .eq("id", stepParam)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sandboxTier
      ? Promise.resolve({ data: [] })
      : supabase
          .from("support_tickets")
          .select("*, setup_steps(title)")
          .eq("client_id", user.id)
          .order("updated_at", { ascending: false }),
  ]);

  const ticketIds = (tickets ?? []).map((t) => t.id);
  const { data: messages } =
    ticketIds.length > 0
      ? await supabase
          .from("support_messages")
          .select("id, ticket_id, author_id, body, created_at")
          .in("ticket_id", ticketIds)
          .order("created_at")
      : { data: [] };

  const messagesByTicket = new Map<string, SupportMessage[]>();
  for (const m of messages ?? []) {
    const list = messagesByTicket.get(m.ticket_id) ?? [];
    list.push({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      fromStaff: m.author_id !== user.id,
    });
    messagesByTicket.set(m.ticket_id, list);
  }

  const businessName = sandboxTier
    ? SANDBOX_LABEL[sandboxTier]
    : (profile?.client_accounts?.name ?? user.email ?? "Your business");

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} sandboxTier={sandboxTier} />

      <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-9">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
          Support
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Ask Josie&rsquo;s team anything about your setup. We usually reply
          within a few hours.
        </p>

        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-bold text-ink">Ask a question</h2>

          {sent && (
            <div className="mt-3 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
              Got it! We&rsquo;ll reply here soon.
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          {sandboxTier ? (
            <p className="mt-3 text-sm text-ink-soft">
              Questions can&rsquo;t be sent from a sandbox, since there&rsquo;s
              no real client to reply to.
            </p>
          ) : (
            <form action={createTicket} className="mt-3 flex flex-col gap-3">
              {step && (
                <>
                  <input type="hidden" name="step_id" value={step.id} />
                  <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
                    About: <span className="font-semibold">{step.title}</span>
                  </div>
                </>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  Subject
                </span>
                <input
                  name="subject"
                  required
                  defaultValue={step ? `Question about ${step.title}` : ""}
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  Your question
                </span>
                <textarea
                  name="message"
                  rows={4}
                  required
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
              >
                Send question
              </button>
            </form>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-[15px] font-bold text-ink">Your questions</h2>
          <div className="mt-3 flex flex-col gap-3">
            {(tickets ?? []).map((t) => (
              <details
                key={t.id}
                open={t.status === "answered"}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-ink">
                      {t.subject}
                    </div>
                    {t.setup_steps?.title && (
                      <div className="text-xs text-ink-faint">
                        {t.setup_steps.title}
                      </div>
                    )}
                  </div>
                  <SupportStatusBadge status={t.status} />
                </summary>
                <div className="mt-4">
                  <SupportThread
                    ticketId={t.id}
                    status={t.status}
                    messages={messagesByTicket.get(t.id) ?? []}
                    viewerIsStaff={false}
                    clientLabel="You"
                  />
                </div>
              </details>
            ))}

            {(tickets ?? []).length === 0 && (
              <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
                No questions yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
