import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { requireStepAccess } from "@/lib/stepAccess";
import { getSandboxTier } from "@/lib/devSandbox";
import { LessonVideoButton } from "@/components/LessonVideoButton";

// The Foundation / Automation setup lessons (Field Setup, Date Setup…):
// everything they prepped, laid out to build in Open to Close. Loads the
// lesson and the account (a client's own, or the one staff picked).
export async function loadSetupLesson(stepKey: string, client: string | undefined) {
  await requireStepAccess(stepKey);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: step }] = await Promise.all([
    supabase.from("profiles").select("role, client_account_id").eq("id", user.id).single(),
    supabase
      .from("setup_steps")
      .select("title, description, video_url, video_thumbnail_url")
      .eq("key", stepKey)
      .limit(1)
      .maybeSingle(),
  ]);
  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const { data: clients } = isStaff
    ? await supabase.from("client_accounts").select("id, name").order("name")
    : { data: [] };
  const accountId = isStaff
    ? (clients ?? []).some((c) => c.id === client)
      ? client!
      : null
    : (profile?.client_account_id ?? null);
  return { supabase, user, step, isStaff, sandboxTier, clients: clients ?? [], accountId };
}

export function SetupShell({
  lesson,
  fallbackTitle,
  blurb,
  wide = false,
  children,
}: {
  lesson: Awaited<ReturnType<typeof loadSetupLesson>>;
  fallbackTitle: string;
  blurb: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { step, isStaff, sandboxTier, clients, accountId } = lesson;
  const title = step?.title ?? fallbackTitle;
  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-12">
      <div className={`w-full ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
        <Link
          href={
            isStaff && !sandboxTier
              ? accountId
                ? `/dashboard/clients/${accountId}`
                : "/dashboard/tasks"
              : "/portal"
          }
          className="text-sm font-medium text-accent"
        >
          &larr;{" "}
          {isStaff && !sandboxTier
            ? accountId
              ? `Back to ${clients.find((c) => c.id === accountId)?.name ?? "client"}`
              : "Back to editor"
            : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm text-accent">
            <span className="font-semibold">
              {accountId ? "Showing this client's setup." : "Pick a client to see their setup."}
            </span>
            <form className="flex items-center gap-2">
              <select
                name="client"
                defaultValue={accountId ?? ""}
                className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
              >
                <option value="">Choose a client&hellip;</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white">
                Show
              </button>
            </form>
          </div>
        )}

        <h1 className="mt-3 font-display text-2xl font-bold text-ink">
          {title}
          <LessonVideoButton url={step?.video_url} thumbnail={step?.video_thumbnail_url} title={title} />
        </h1>
        {step?.description ? (
          <div
            className="mt-1.5 text-sm leading-relaxed text-ink-soft
              [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
              [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
              [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:mt-1 first:[&>*]:mt-0"
          >
            <ReactMarkdown>{step.description}</ReactMarkdown>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-soft">{blurb}</p>
        )}

        <div className="mt-6">
          {accountId ? (
            children
          ) : (
            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
              Choose a client above to see their setup.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
