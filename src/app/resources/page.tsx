import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";

const STEP_TYPE_LABEL: Record<string, string> = {
  video: "Video",
  configurator: "Configurator",
  download: "Download",
  external_link: "Link",
  form: "Guide",
};

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, client_accounts(name, setup_path)")
    .eq("id", user.id)
    .single();

  const setupPath = profile?.client_accounts?.setup_path ?? "custom";

  const { data: steps } = await supabase
    .from("setup_steps")
    .select("*")
    .eq("path", setupPath)
    .order("sort_order");

  const businessName =
    profile?.client_accounts?.name ?? user.email ?? "Your business";
  const initials = businessName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const phases = Array.from(
    new Set((steps ?? []).map((s) => s.phase ?? "General")),
  );

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} initials={initials} active="resources" />

      <div className="px-12 pt-9">
        <h1 className="font-display text-[25px] font-bold text-ink">
          Resource Center
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Every step in your OTC setup, organized by phase. Required items are
          the core build &mdash; optional items are nice-to-haves you can
          tackle later without holding up your launch.
        </p>
      </div>

      <div className="flex flex-col gap-5 px-12 pb-12 pt-7">
        {phases.map((phase) => {
          const phaseSteps = (steps ?? []).filter(
            (s) => (s.phase ?? "General") === phase,
          );
          const sections = Array.from(
            new Set(phaseSteps.map((s) => s.section)),
          );

          return (
            <details
              key={phase}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <summary className="cursor-pointer font-display text-lg font-bold text-ink">
                {phase}
              </summary>

              <div className="mt-4 flex flex-col gap-6">
                {sections.map((section) => {
                  const sectionSteps = phaseSteps.filter(
                    (s) => s.section === section,
                  );
                  const required = sectionSteps.filter((s) => !s.is_optional);
                  const optional = sectionSteps.filter((s) => s.is_optional);

                  return (
                    <div key={section}>
                      <h3 className="text-sm font-bold text-ink">{section}</h3>

                      {required.length > 0 && (
                        <div className="mt-2.5">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                            Required
                          </h4>
                          <ul className="mt-2 flex flex-col gap-2">
                            {required.map((step) => (
                              <ResourceItem key={step.id} step={step} />
                            ))}
                          </ul>
                        </div>
                      )}

                      {optional.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                            Optional &mdash; can wait
                          </h4>
                          <ul className="mt-2 flex flex-col gap-2">
                            {optional.map((step) => (
                              <ResourceItem key={step.id} step={step} />
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}

        {(steps ?? []).length === 0 && (
          <p className="text-sm text-ink-soft">
            No resources configured yet for this path.
          </p>
        )}
      </div>
    </main>
  );
}

function ResourceItem({
  step,
}: {
  step: {
    id: string;
    title: string;
    description: string | null;
    step_type: string;
    resource_url: string | null;
  };
}) {
  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-border-soft bg-bg px-4 py-3">
      <div className="flex-1">
        <div className="text-sm font-bold text-ink">{step.title}</div>
        {step.description && (
          <div className="mt-0.5 text-xs text-ink-soft">
            {step.description}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
          {STEP_TYPE_LABEL[step.step_type] ?? step.step_type}
        </span>
        {step.resource_url && (
          <a
            href={step.resource_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
          >
            Open &rarr;
          </a>
        )}
      </div>
    </li>
  );
}
