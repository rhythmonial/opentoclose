import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { getVideoEmbedUrl } from "@/lib/videoEmbed";
import { effectiveOwner, type EngagementType } from "@/lib/stepOwnership";
import { toggleLessonComplete } from "../actions";

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

  const [{ data: profile }, { data: step }] = await Promise.all([
    supabase
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

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";

  const { data: resources } = await supabase
    .from("setup_step_resources")
    .select("*")
    .eq("step_id", step.id)
    .order("sort_order");

  const businessName =
    profile?.client_accounts?.name ?? user.email ?? "Your business";

  let status = "not_started";
  let isHandledByStaff = false;

  if (!isStaff) {
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
      "custom") as EngagementType;
    isHandledByStaff =
      effectiveOwner(step.completed_by, engagementType) === "staff";
  }

  const embedUrl = step.video_url ? getVideoEmbedUrl(step.video_url) : null;
  const isApproved = status === "approved";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      {isStaff ? (
        <StaffNav />
      ) : (
        <TopNav businessName={businessName} active="setup" />
      )}

      <div className="mx-auto w-full max-w-3xl px-6 py-9">
        <Link
          href={isStaff ? "/profile" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff ? "Back to editor" : "Back to your setup"}
        </Link>

        {isStaff && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Previewing this lesson the way a client sees it &mdash; actions
            are disabled here.
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
          {!isStaff && (
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
            {embedUrl ? (
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
          <p className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">
            {step.description}
          </p>
        )}

        {(resources ?? []).length > 0 && (
          <div className="mt-7">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Resources
            </h2>
            <div className="mt-2.5 flex flex-col gap-2">
              {(resources ?? []).map((r) => (
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
              ))}
            </div>
          </div>
        )}

        {!isStaff && (
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
