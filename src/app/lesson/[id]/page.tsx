import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { freeMonthStatus } from "@/lib/coupons";
import { SupportButton } from "@/components/SupportButton";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { getVideoSource } from "@/lib/videoEmbed";
import { VideoPlayer } from "@/components/VideoPlayer";
import {
  isDelegable,
  effectiveOwner,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";
import { toggleLessonComplete } from "../actions";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";
import { startPlanCheckout, startStepCheckout } from "@/app/checkout/actions";
import { getHourlyRate } from "@/lib/hourlyRate";
import { createAdminClient } from "@/lib/supabase/admin";
import { RequestSetupButton } from "@/components/RequestSetupButton";
import { stepClientHref } from "@/lib/stepHref";
import { PLAN_PRICES, formatDollars, planPriceLabel, stepPriceCents } from "@/lib/pricing";
import { progressOwnerId } from "@/lib/accountOwner";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    paid?: string;
    error?: string;
    requested?: string;
    hours?: string;
    asked?: string;
  }>;
}) {
  const { id } = await params;
  const { paid, error, hours: hoursBought, asked } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Teammates share the owner's progress, setup form and plan.
  const accountUserId = await progressOwnerId(supabase, user.id);

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
          .select("*, client_accounts(name, setup_path, unlock_all)")
          .eq("id", user.id)
          .single(),
    supabase.from("setup_steps").select("*").eq("id", id).maybeSingle(),
  ]);

  // Their checklist's lessons, for the Get support form.
  const { data: lessonRows } = isStaff
    ? { data: [] }
    : await supabase
        .from("setup_steps")
        .select("id, title, phase")
        .eq("path", profile?.client_accounts?.setup_path ?? "custom")
        .order("sort_order");
  const supportLessons = (lessonRows ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    phase: l.phase ?? "General",
  }));

  if (!step) {
    notFound();
  }

  // Configurators (like Initiate Your Setup) are their own pages.
  if (step.step_type === "configurator") {
    redirect(stepClientHref(step));
  }

  // End a coupon's free month that's run out before the plan is read.
  if (!isStaff) await freeMonthStatus(profile?.client_account_id);

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
  let clientPlan: EngagementType | null = null;
  let hasInitiation = false;
  let isPurchased = false;

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
      clientPlan = sandboxTier;
      hasInitiation = true;
      // Free accounts follow the DIY checklist.
      const ownershipPlan: PlanType = sandboxTier === "custom" ? "custom" : "diy";
      // Lessons our team handles are theirs to do or request on DIY/Setup.
      isHandledByStaff =
        effectiveOwner(step.completed_by, ownershipPlan) === "staff" &&
        !isDelegable(step.completed_by, sandboxTier);

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
      const [{ data: statusRow }, { data: initiation }, { data: purchase }] =
        await Promise.all([
        supabase
          .from("client_step_status")
          .select("status")
          .eq("client_id", accountUserId)
          .eq("step_id", step.id)
          .maybeSingle(),
        supabase
          .from("setup_initiation")
          .select("engagement_type")
          .eq("client_id", accountUserId)
          .maybeSingle(),
        supabase
          .from("payments")
          .select("id")
          .eq("client_id", accountUserId)
          .eq("kind", "step")
          .eq("step_id", step.id)
          .limit(1)
          .maybeSingle(),
      ]);

      status = statusRow?.status ?? "not_started";
      const engagementType = (initiation?.engagement_type ??
        "free") as EngagementType;
      isFreeTier = engagementType === "free";
      clientPlan = engagementType;
      hasInitiation = Boolean(initiation);
      isPurchased = Boolean(purchase);
      // Free accounts follow the DIY checklist.
      const ownershipPlan: PlanType = engagementType === "custom" ? "custom" : "diy";
      // Lessons our team handles are theirs to do or request on DIY/Setup.
      isHandledByStaff =
        (effectiveOwner(step.completed_by, ownershipPlan) === "staff" &&
          !isDelegable(step.completed_by, engagementType)) ||
        isPurchased;

      // First visit to a not-yet-started task marks it in progress, so the
      // portal list can show "Continue" instead of "Start" afterward.
      if (status === "not_started" && !isHandledByStaff) {
        await supabase.from("client_step_status").upsert(
          {
            client_id: accountUserId,
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

  // The editor's "View as the client sees it" preview shows the end of the
  // lesson as a DIY client sees it (the plan with the set-up and purchase
  // options), with payments, completing and support turned off.
  const isEditorPreview = isStaff && !isSandboxing;
  if (isEditorPreview) {
    clientPlan = "diy";
    hasInitiation = true;
    isHandledByStaff =
      effectiveOwner(step.completed_by, "diy") === "staff" &&
      !isDelegable(step.completed_by, "diy");
  }
  const previewing = isSandboxing || isEditorPreview;

  // Sandboxing shows content exactly as that tier's real client would see it
  // (locked if Free) — only a plain, non-sandboxing staff preview always
  // sees everything unlocked.
  // Lessons open on a paid plan (DIY, Setup or a free month); they pay when
  // they sign up.
  const canViewContent =
    (isStaff && !isSandboxing) || !isFreeTier || Boolean(profile?.client_accounts?.unlock_all);
  const videoSource = step.video_url ? getVideoSource(step.video_url) : null;
  const isApproved = status === "approved";

  const isPaidStep = step.key === "setup_paid";
  const estimatedHours = Number(step.estimated_hours ?? 0);
  const canBuyStep =
    clientPlan !== null &&
    clientPlan !== "custom" &&
    step.completed_by !== "staff" &&
    estimatedHours > 0 &&
    !isApproved &&
    !isPurchased &&
    !isPaidStep;
  // On lessons our team handles, DIY and Setup clients can do it themselves
  // or ask our team to set it up with their setup hours (Setup clients use
  // their remaining hours; anyone out of hours can buy more). Previews show
  // it as that plan's client would.
  const canRequestSetup =
    isDelegable(step.completed_by, clientPlan) &&
    !isApproved &&
    (isStaff || Boolean(profile?.client_account_id));
  let setupHours = {
    // The Setup sandbox comes with the 10-hour bundle.
    purchased: isSandboxing && clientPlan === "custom" ? PLAN_PRICES.setup.hours : 0,
    used: 0,
    requested: false,
  };
  if (canRequestSetup && !isStaff && profile?.client_account_id) {
    const admin = createAdminClient();
    const [{ data: account }, { data: members }, { data: openRequest }] = await Promise.all([
      admin
        .from("client_accounts")
        .select("hours_purchased")
        .eq("id", profile.client_account_id)
        .single(),
      admin.from("profiles").select("id").eq("client_account_id", profile.client_account_id),
      supabase
        .from("setup_requests")
        .select("id")
        .eq("client_account_id", profile.client_account_id)
        .eq("step_id", step.id)
        .is("done_at", null)
        .limit(1)
        .maybeSingle(),
    ]);
    const ids = (members ?? []).map((m) => m.id);
    const { data: log } = ids.length
      ? await admin.from("hours_log").select("hours").in("client_id", ids)
      : { data: [] as { hours: number }[] };
    setupHours = {
      purchased: Number(account?.hours_purchased ?? 0),
      used: (log ?? []).reduce((sum, h) => sum + Number(h.hours), 0),
      requested: Boolean(openRequest),
    };
  }
  const hoursLeft = Math.max(0, setupHours.purchased - setupHours.used);
  const outOfHours = hoursLeft <= 0;
  const hourlyRate = canBuyStep || canRequestSetup ? await getHourlyRate() : 0;

  // The lesson after this one, to move on once they've requested a set up.
  const { data: nextLesson } = setupHours.requested
    ? await supabase
        .from("setup_steps")
        .select("id, key, step_type")
        .eq("path", step.path)
        .gt("sort_order", step.sort_order)
        .order("sort_order")
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      {isStaff && !isSandboxing ? (
        <StaffNav isDev={realProfile?.role === "dev"} />
      ) : (
        <TopNav
          businessName={businessName}
          active="setup"
          sandboxTier={sandboxTier}
        />
      )}

      <div className="mx-auto w-full max-w-3xl px-6 py-9">
        <Link
          href={isStaff && !isSandboxing ? "/dashboard/tasks" : "/portal"}
          className="text-sm font-medium text-accent"
        >
          &larr; {isStaff && !isSandboxing ? "Back to editor" : "Back to your setup"}
        </Link>

        {isStaff && !isSandboxing && (
          <div className="mt-4 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Previewing this lesson the way a DIY client sees it &mdash;
            payments and actions are off here.
          </div>
        )}

        {hoursBought === "purchased" && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
            Thanks! Your new hours show up as soon as the payment goes through; then you can
            request your set up.
          </div>
        )}

        {paid && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
            Payment received, thank you! Our team will take it from here.
          </div>
        )}

        {asked && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-semibold text-success">
            Question sent! We usually respond within 24 hours. You&rsquo;ll see our
            reply in <Link href="/support" className="underline">Support</Link>.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        {!canViewContent && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm text-accent sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">
              Choose a plan (DIY or Setup) to open this lesson.
            </span>
            {!isStaff && (
              <Link
                href="/setup"
                className="shrink-0 self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Choose a plan &rarr;
              </Link>
            )}
          </div>
        )}

        <div className="mt-4 text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
          {step.phase ?? "General"} &middot; {step.section}
        </div>

        <div className="mt-1.5 flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink">
            {step.title}
            {isStaff && !step.is_published && (
              <span className="ml-2 rounded-full bg-ink-faint/15 px-2 py-0.5 align-middle font-caption text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                Hidden from clients
              </span>
            )}
          </h1>
          {(!isStaff || isSandboxing) && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide ${
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
            ) : videoSource ? (
              <VideoPlayer
                source={videoSource}
                thumbnail={step.video_thumbnail_url}
                title={step.title}
              />
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

        {/* After the field prep video, DIY clients get another chance to
            add a Setup. */}
        {step.key === "understand_your_field_prep" && clientPlan === "diy" && !isEditorPreview && (
          <div className="mt-6 flex flex-col gap-2 rounded-xl border-2 border-gold bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-ink">Want our team to build it for you?</div>
              <p className="mt-0.5 text-sm text-ink-soft">
                Add a Setup and we&rsquo;ll handle the rest of your build with you.
              </p>
            </div>
            <Link
              href="/setup?plan=setup"
              className="shrink-0 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:self-auto"
            >
              Add a Setup &rarr;
            </Link>
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
            <h2 className="text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
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

        {canViewContent && (
        <div className="mt-9 border-t border-border-soft pt-6">
            {canRequestSetup && (
              <div className="mb-6 rounded-xl border border-accent-soft bg-accent-soft/40 p-5">
                <h2 className="text-[15px] font-bold text-ink">Want our team to set this up?</h2>
                {!setupHours.requested && (
                  <p className="mt-1 mb-3 text-sm text-ink-soft">
                    Do it yourself below, or request a set up and we&rsquo;ll do it for you
                    {outOfHours
                      ? ". You’re out of setup hours, so add more to request one."
                      : clientPlan === "custom"
                        ? " using your remaining setup hours."
                        : " using your setup hours."}
                    {!outOfHours && (
                      <>
                        {" "}
                        You have{" "}
                        <span className="font-semibold text-ink">
                          {Number(hoursLeft.toFixed(1))} hour{hoursLeft === 1 ? "" : "s"}
                        </span>{" "}
                        left.
                      </>
                    )}
                  </p>
                )}
                <div className={setupHours.requested ? "mt-2" : ""}>
                  <RequestSetupButton
                    stepId={step.id}
                    stepTitle={step.title}
                    purchased={setupHours.purchased}
                    used={setupHours.used}
                    hourlyRate={hourlyRate}
                    canBuy={isStaff || profile?.role === "client_owner"}
                    requested={setupHours.requested}
                    requestDisabled={previewing}
                  />
                </div>
                {setupHours.requested && nextLesson && (
                  <Link
                    href={stepClientHref(nextLesson)}
                    className="mt-3 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Next lesson &rarr;
                  </Link>
                )}
              </div>
            )}
            {canBuyStep && (
              <div className="mb-6 rounded-xl border border-accent-soft bg-accent-soft/40 p-5">
                <h2 className="text-[15px] font-bold text-ink">
                  Want our team to do this for you?
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Estimated {estimatedHours} hour
                  {estimatedHours === 1 ? "" : "s"} &times; $
                  {hourlyRate}/hr ={" "}
                  <span className="font-bold text-ink">
                    {formatDollars(stepPriceCents(estimatedHours, hourlyRate))}
                  </span>
                </p>
                <form action={startStepCheckout} className="mt-3">
                  <input type="hidden" name="step_id" value={step.id} />
                  <button
                    type="submit"
                    disabled={previewing}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 bg-navy text-white"
                  >
                    Have our team do it &rarr;
                  </button>
                  {previewing && (
                    <span className="ml-3 text-xs text-ink-faint">
                      Checkout is off in previews.
                    </span>
                  )}
                </form>
              </div>
            )}

            {isPaidStep && !isApproved && clientPlan !== "custom" ? (
              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-[15px] font-bold text-ink">
                  {clientPlan === "diy" ? "Upgrade to Setup" : "Pay for your plan"}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  This step completes automatically once your payment goes
                  through.
                </p>
                {hasInitiation ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(clientPlan === "diy"
                      ? (["setup"] as const)
                      : (["setup", "diy"] as const)
                    ).map((plan) => (
                      <form key={plan} action={startPlanCheckout}>
                        <input type="hidden" name="plan" value={plan} />
                        <input
                          type="hidden"
                          name="return_to"
                          value={`/lesson/${step.id}`}
                        />
                        <button
                          type="submit"
                          disabled={previewing}
                          className={`rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                            plan === "setup"
                              ? "bg-navy text-white"
                              : "border border-navy text-navy"
                          }`}
                        >
                          Pay for {PLAN_PRICES[plan].label} (
                          {planPriceLabel(plan)})
                        </button>
                      </form>
                    ))}
                    {previewing && (
                      <span className="text-xs text-ink-faint">
                        Checkout is off in previews.
                      </span>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/setup"
                    className="mt-3 inline-block rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Fill out Setup Initiation first &rarr;
                  </Link>
                )}
              </div>
            ) : isPurchased && !isApproved ? (
              <p className="text-sm font-medium text-ink-faint">
                You purchased this step &mdash; our team is on it and will
                mark it complete once it&rsquo;s done.
              </p>
            ) : isHandledByStaff ? (
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
                  disabled={isEditorPreview}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                    isApproved
                      ? "border border-border text-ink"
                      : "bg-accent text-white"
                  }`}
                >
                  {isApproved ? "Mark as Incomplete" : "Mark as Complete"}
                </button>
              </form>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-soft pt-5">
              <span className="text-sm text-ink-soft">Stuck on this lesson?</span>
              {previewing ? (
                <span className="text-xs text-ink-faint">
                  Support is off in previews.
                </span>
              ) : (
                <SupportButton lessons={supportLessons} stepId={step.id} />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
