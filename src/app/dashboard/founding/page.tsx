import { createClient } from "@/lib/supabase/server";
import { QUESTIONS } from "@/app/founding/questions";

// Staff: founding group applications, newest first.
export default async function FoundingApplicationsPage() {
  const supabase = await createClient();
  const { data: apps } = await supabase
    .from("founding_applications")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Founding group applications ({apps?.length ?? 0})</h1>
      <p className="mt-1 text-sm text-ink-soft">From the application form at /founding.</p>
      <div className="mt-6 flex flex-col gap-3">
        {(apps ?? []).length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-faint">No applications yet.</p>
        )}
        {(apps ?? []).map((a) => {
          const answers = (a.answers ?? {}) as Record<string, string>;
          return (
            <details key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">
                  {a.business_name}{" "}
                  <span className="font-normal text-ink-soft">
                    &middot; {a.company_structure} &middot; {a.first_name} {a.last_name}
                  </span>
                </span>
                <span className="text-xs text-ink-faint">
                  {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </summary>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[14rem_1fr]">
                <dt className="text-ink-faint">Contact</dt>
                <dd className="text-ink">
                  <a href={`mailto:${a.email}`} className="text-accent">{a.email}</a>
                  {a.phone && ` · ${a.phone}`}
                </dd>
                <dt className="text-ink-faint">States</dt>
                <dd className="text-ink">
                  {a.states_serviced ?? "—"}
                  {a.priority_state && ` (priority: ${a.priority_state})`}
                </dd>
                <dt className="text-ink-faint">Tools</dt>
                <dd className="text-ink">
                  {[a.tms && `TMS: ${a.tms}`, a.email_provider && `Email: ${a.email_provider}`, a.esign_platform && `E-sign: ${a.esign_other || a.esign_platform}`]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
                {QUESTIONS.map((q) => (
                  <div key={q.key} className="contents">
                    <dt className="text-ink-faint">{q.label}</dt>
                    <dd className="whitespace-pre-wrap text-ink">{answers[q.key] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </details>
          );
        })}
      </div>
    </main>
  );
}
