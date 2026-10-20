import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { getVideoEmbedUrl } from "@/lib/videoEmbed";
import {
  effectiveOwner,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";
import { toggleLessonComplete } from "../actions";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  returned: "Needs Changes",
  approved: "Complete",
  locked: "Locked",
};

const RESOURCE_KIND_LABEL: Record<string, string> = {
  google_doc: "Open & make a copy",
  pdf: "Download PDF",
  link: "Open",
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [{ data: profile }, { data: step }] = await Promise.all([
    isStaff
      ? Promise.resolve({ data: null })
      : supabase
          .from("profiles")
          .select("*, client_accounts(name)")
          .eq("id", user.id)
          .single(),
    supabase.from("setup_steps").select("*").eq("id", id).maybeSingle(),
  ]);

  if (!step) {
    notFound();
  }

  if ((step.step_type === "form" || step.step_type === "link") && step.link_url) {
    redirect(step.link_url);
  }

  const { data: resources } = await supabase
    .from("setup_step_resources")
    .select("*")
    .eq("step_id", step.id)
    .order("sort_order");

  const businessName = isStaff
    ? isSandboxing
      ? SANDBOX_LABEL[sandboxTier!]
      : "Preview"
    : (profile?.client_accounts?.name ?? user.email ?? "Your business");

  let status = "not_started";
  let isHandledByStaff = false;
  let isFreeTier = false;

  if (!isStaff || isSandboxing) {
    if (isSandboxing) {
      const { data: statusRow } = await supabase
        .from("dev_sandbox_step_status")
        .select("status")
        .eq("tier", sandboxTier!)
        .eq("step_id", step.id)
        .maybeSingle();

      status = statusRow?.status ?? "not_started";
      isFreeTier = sandboxTier === "free";
      // Free accounts haven't paid for staff to handle anything yet, so
      // they're treated like DIY for the purpose of "is this mine to do".
      const ownershipPlan: PlanType = sandboxTier === "custom" ? "custom" : "diy";
      isHandledByStaff =
        effectiveOwner(step.completed_by, ownershipPlan) === "staff";

      // First visit to a not-yet-started task marks it in progress, so the
      // portal list can show "Continue" instead of "Start" afterward —
      // sandboxing is fully interactive, so this persists just like a real
      // client's progress would.
      if (status === "not_started" && !isHandledByStaff) {
        await supabase.from("dev_sandbox_step_status").upsert(
          {
            tier: sandboxTier!,
            step_id: step.id,
            status: "in_progress",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tier,step_id" },
        );
        status = "in_progress";
      }
    } else {
      const [{ data: statusRow }, { data: initiation }] = await Promise.all([
        supabase
          .from("client_step_status")
          .select("status")
          .eq("client_id", user.id)
          .eq("step_id", step.id)
          .maybeSingle(),
        supabase
          .from("setup_initiation")
          .select("engagement_type")
          .eq("client_id", user.id)
          .maybeSingle(),
      ]);

      status = statusRow?.status ?? "not_started";
      const engagementType = (initiation?.engagement_type ??
        "free") as EngagementType;
      isFreeTier = engagementType === "free";
      // Free accounts haven't paid for staff to handle anything yet, so
      // they're treated like DIY for the purpose of "is this mine to do".
      const ownershipPlan: PlanType = engagementType === "custom" ? "custom" : "diy";
      isHandledByStaff =
        effectiveOwner(step.completed_by, ownershipPlan) === "staff";

      // First visit to a not-yet-started task marks it in progress, so the
      // portal list can show "Continue" instead of "Start" afterward.
      if (status === "not_started" && !isHandledByStaff) {
        await supabase.from("client_step_status").upsert(
          {
            client_id: user.id,
            step_id: step.id,
            status: "in_progress",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id,step_id" },
        );
        status = "in_progress";
      }
    }
  }

  // Sandboxing shows content exactly as that tier's real client would see it
  // (locked if Free) — only a plain, non-sandboxing staff preview always
  // sees everything unlocked.
  const canViewContent = (isStaff && !isSandboxing) || !isFreeTier;
  const embedUrl = step.video_url ? getVideoEmbedUrl(step.video_url) : null;
  const isApproved = status === "approved";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      {isStaff && !isSandboxing ? (
        <StaffNav />
      ) : (
        <TopNav
          businessName={businessName}
          active="setup"
          sandboxTier={sandboxTier}
        />
      )}

      <div className="mx-auto w-full max-w-3xl px-6 py-9">
        <Link
          href={isStaff && !isSandboxing ? "/profile" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff && !isSandboxing ? "Back to editor" : "Back to your setup"}
        </Link>

        {isStaff && !isSandboxing && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Previewing this lesson the way a client sees it &mdash; actions
            are disabled here.
          </div>
        )}

        {isFreeTier && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Sign up for Setup or DIY to unlock the video and resources below.
          </div>
        )}

        <div className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-faint">
          {step.phase ?? "General"} &middot; {step.section}
        </div>

        <div className="mt-1.5 flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink">
            {step.title}
            {step.is_optional && (
              <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                Optional
              </span>
            )}
          </h1>
          {(!isStaff || isSandboxing) && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                status === "approved"
                  ? "bg-success-soft text-success"
                  : status === "returned"
                    ? "bg-warning-soft text-warning"
                    : status === "submitted" || status === "in_progress"
                      ? "bg-accent-soft text-accent"
                      : "bg-border-soft text-ink-faint"
              }`}
            >
              {STATUS_LABEL[status].toUpperCase()}
            </span>
          )}
        </div>

        {step.video_url && (
          <div className="mt-6">
            {!canViewContent ? (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-border bg-black text-white/70">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-sm font-semibold">
                  Sign up to watch this video
                </span>
              </div>
            ) : embedUrl ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  src={embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <a
                href={step.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-navy px-5 py-4 text-white"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="text-sm font-semibold">Watch the video</span>
              </a>
            )}
          </div>
        )}

        {step.description && (
          <div
            className="mt-6 text-[15px] leading-relaxed text-ink-soft
              [&_h1]:mt-4 [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-ink
              [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink
              [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink
              [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
              [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
              [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:mt-1 first:[&>*]:mt-0"
          >
            <ReactMarkdown>{step.description}</ReactMarkdown>
          </div>
        )}

        {(resources ?? []).length > 0 && (
          <div className="mt-7">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Resources
            </h2>
            <div className="mt-2.5 flex flex-col gap-2">
              {(resources ?? []).map((r) =>
                canViewContent ? (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...(r.kind === "pdf" ? { download: true } : {})}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink"
                  >
                    {r.label || RESOURCE_KIND_LABEL[r.kind] || "Open"}
                    <span className="text-ink-faint">&rarr;</span>
                  </a>
                ) : (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border-soft bg-bg px-4 py-3 text-sm font-semibold text-ink-faint"
                  >
                    {r.label || RESOURCE_KIND_LABEL[r.kind] || "Open"}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {(!isStaff || isSandboxing) && (
          <div className="mt-9 border-t border-border-soft pt-6">
            {isHandledByStaff ? (
              <p className="text-sm font-medium text-ink-faint">
                This step is handled by our team &mdash; we&rsquo;ll mark it
                complete once it&rsquo;s done.
              </p>
            ) : (
              <form action={toggleLessonComplete}>
                <input type="hidden" name="step_id" value={step.id} />
                <input
                  type="hidden"
                  name="currently_approved"
                  value={String(isApproved)}
                />
                <button
                  type="submit"
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${
                    isApproved
                      ? "border border-border text-ink"
                      : "bg-accent text-white"
                  }`}
                >
                  {isApproved ? "Mark as Incomplete" : "Mark as Complete"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
