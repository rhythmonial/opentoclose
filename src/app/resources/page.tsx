import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";
import type { EngagementType } from "@/lib/stepOwnership";

const STEP_TYPE_LABEL: Record<string, string> = {
  lesson: "Lesson",
  form: "Form",
  link: "Link",
  configurator: "Configurator",
};

const RESOURCE_KIND_LABEL: Record<string, string> = {
  google_doc: "Open & make a copy",
  pdf: "Download PDF",
  link: "Open",
};

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: realProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isStaff =
    realProfile?.role === "dev" || realProfile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const isSandboxing = Boolean(sandboxTier);

  if (isStaff && !isSandboxing) {
    return (
      <main className="flex min-h-screen flex-col bg-bg">
        <StaffNav />
        <div className="px-4 py-9 sm:px-6 lg:px-12">
          <p className="text-sm text-ink-soft">
            Enter a Free/DIY/Setup sandbox from the dashboard to preview the
            Resource Center.
          </p>
        </div>
      </main>
    );
  }

  const { data: profile } = isSandboxing
    ? { data: null }
    : await supabase
        .from("profiles")
        .select("*, client_accounts(name, setup_path)")
        .eq("id", user.id)
        .single();

  const engagementType = isSandboxing
    ? (sandboxTier as EngagementType)
    : ((
        await supabase
          .from("setup_initiation")
          .select("engagement_type")
          .eq("client_id", user.id)
          .maybeSingle()
      ).data?.engagement_type ?? "free") as EngagementType;
  const canViewContent = engagementType !== "free";

  const setupPath = profile?.client_accounts?.setup_path ?? "custom";

  const { data: steps } = await supabase
    .from("setup_steps")
    .select("*")
    .eq("path", setupPath)
    .order("sort_order");

  const stepIds = (steps ?? []).map((s) => s.id);

  const { data: resources } =
    stepIds.length > 0
      ? await supabase
          .from("setup_step_resources")
          .select("*")
          .in("step_id", stepIds)
          .order("sort_order")
      : { data: [] };

  const resourcesByStep = new Map<string, typeof resources>();
  for (const r of resources ?? []) {
    const list = resourcesByStep.get(r.step_id) ?? [];
    list.push(r);
    resourcesByStep.set(r.step_id, list);
  }

  const businessName = isSandboxing
    ? SANDBOX_LABEL[sandboxTier!]
    : (profile?.client_accounts?.name ?? user.email ?? "Your business");

  const phases = Array.from(
    new Set((steps ?? []).map((s) => s.phase ?? "General")),
  );

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav
        businessName={businessName}
        active="resources"
        isSandboxing={isSandboxing}
      />

      {isSandboxing && (
        <div className="mx-4 mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm font-semibold text-danger sm:mx-6 lg:mx-12">
          Sandboxing as {businessName} &mdash; progress here persists until
          you reset it. Click the eye icon next to your profile to return to
          the dev dashboard.
        </div>
      )}

      <div className="px-4 pt-6 sm:px-6 sm:pt-9 lg:px-12">
        <h1 className="font-display text-xl font-bold text-ink sm:text-[25px]">
          Resource Center
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Every step in your OTC setup, organized by phase. Required items are
          the core build &mdash; optional items are nice-to-haves you can
          tackle later without holding up your launch.
        </p>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-10 pt-6 sm:px-6 sm:pt-7 lg:px-12 lg:pb-12">
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
                              <ResourceItem
                                key={step.id}
                                step={step}
                                resources={resourcesByStep.get(step.id) ?? []}
                                canViewContent={canViewContent}
                              />
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
                              <ResourceItem
                                key={step.id}
                                step={step}
                                resources={resourcesByStep.get(step.id) ?? []}
                                canViewContent={canViewContent}
                              />
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
  resources,
  canViewContent,
}: {
  step: {
    id: string;
    title: string;
    description: string | null;
    step_type: string;
    video_url: string | null;
    link_url: string | null;
  };
  resources: { id: string; kind: string; label: string | null; url: string }[];
  canViewContent: boolean;
}) {
  const isExternal =
    (step.step_type === "form" || step.step_type === "link") &&
    Boolean(step.link_url);

  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-border-soft bg-bg px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink">{step.title}</div>
          {step.description && (
            <div className="mt-0.5 text-xs text-ink-soft">
              {step.description}
            </div>
          )}
        </div>
        <span className="self-start rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent sm:shrink-0">
          {STEP_TYPE_LABEL[step.step_type] ?? step.step_type}
        </span>
      </div>

      {isExternal && (
        <a
          href={step.link_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
        >
          Open &rarr;
        </a>
      )}

      {!canViewContent && (step.video_url || resources.length > 0) && (
        <p className="text-xs font-medium text-ink-faint">
          Sign up for Setup or DIY to unlock the video and resources for this
          step.
        </p>
      )}

      {canViewContent && (step.video_url || resources.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {step.video_url && (
            <a
              href={step.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch the video
            </a>
          )}
          {resources.map((r) => (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              {...(r.kind === "pdf" ? { download: true } : {})}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
            >
              {r.label || RESOURCE_KIND_LABEL[r.kind] || "Open"}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
