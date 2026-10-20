import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { CompletedByRadios } from "@/components/CompletedByRadios";
import { OptionalToggle } from "@/components/OptionalToggle";
import { FutureBuildToggle } from "@/components/FutureBuildToggle";
import { PhaseSectionPicker } from "@/components/PhaseSectionPicker";
import { LessonTypeFields } from "@/components/LessonTypeFields";
import { MarkdownTextarea } from "@/components/MarkdownTextarea";
import { SaveStepButton } from "@/components/SaveStepButton";
import { StepResourcesEditor } from "@/components/StepResourcesEditor";
import { SortableGroup } from "@/components/dnd/SortableGroup";
import { signOut } from "@/app/login/actions";
import { updateProfileInfo, inviteClientAdmin, inviteStaff } from "./actions";
import {
  addStep,
  updateStep,
  deleteStep,
  deletePillar,
  deleteSection,
  reorderSteps,
} from "./setup-steps-actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import type { Tables } from "@/lib/supabase/types";
import { stepClientHref } from "@/lib/stepHref";

type SetupStep = Tables<"setup_steps">;
type StepResource = Tables<"setup_step_resources">;

const CLIENT_ROLE_LABEL: Record<string, string> = {
  client_owner: "Client",
  client_admin: "Admin",
};

const STAFF_ROLE_LABEL: Record<string, string> = {
  dev: "Dev",
  dev_admin: "Technician",
};


export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    invited?: string;
    saved?: string;
    stepFilter?: string;
  }>;
}) {
  const { error, invited, saved, stepFilter } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, name, phone, client_account_id")
    .eq("id", user.id)
    .single();

  const isStaff = profile?.role === "dev" || profile?.role === "dev_admin";

  if (isStaff) {
    const [{ data: staff }, { data: steps }, { data: resources }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, role, email, name, first_login_at")
          .in("role", ["dev", "dev_admin"])
          .order("created_at"),
        supabase
          .from("setup_steps")
          .select("*")
          .order("path")
          .order("sort_order"),
        supabase.from("setup_step_resources").select("*").order("sort_order"),
      ]);

    const resourcesByStep = new Map<string, StepResource[]>();
    for (const r of resources ?? []) {
      const list = resourcesByStep.get(r.step_id) ?? [];
      list.push(r);
      resourcesByStep.set(r.step_id, list);
    }

    const canInvite = profile?.role === "dev_admin";
    const canManageStaff = profile?.role === "dev";
    const canSeeSetupSteps = profile?.role === "dev";

    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <StaffNav />

        <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
          <h1 className="font-display text-xl font-bold text-ink sm:text-[25px]">
            Profile
          </h1>

          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:gap-8">
            <section className="w-full rounded-xl border border-border bg-surface p-5 lg:w-[340px] lg:shrink-0">
              {saved && (
                <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                  Profile saved.
                </div>
              )}
              <form action={updateProfileInfo} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Name</span>
                  <input
                    name="name"
                    defaultValue={profile?.name ?? ""}
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Email</span>
                  <input
                    value={user.email ?? ""}
                    disabled
                    className="rounded-lg border border-border bg-border-soft px-3 py-2 text-sm text-ink-soft"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">
                    Phone number
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  Save
                </button>
              </form>
            </section>

            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <h2 className="text-[15px] font-bold text-ink">
                Internal team
              </h2>
              {(staff ?? []).map((member) => {
                const row = (
                  <>
                    <div className="flex-1">
                      <div className="text-[15px] font-bold text-ink">
                        {member.name || "Pending"}
                        {member.id === user.id && (
                          <span className="ml-2 text-xs font-medium text-ink-faint">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-ink-soft">
                        {STAFF_ROLE_LABEL[member.role] ?? member.role}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                        member.first_login_at
                          ? "bg-success-soft text-success"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {(member.first_login_at ? "active" : "invited").toUpperCase()}
                    </span>
                    {canManageStaff && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-ink-faint"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </>
                );

                return canManageStaff ? (
                  <Link
                    key={member.id}
                    href={`/profile/staff/${member.id}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px] hover:border-accent"
                  >
                    {row}
                  </Link>
                ) : (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px]"
                  >
                    {row}
                  </div>
                );
              })}
            </div>

            {canInvite && (
              <div className="flex w-full flex-col gap-5 lg:w-[340px] lg:shrink-0">
                <div className="rounded-xl border border-border bg-surface p-5">
                  <h3 className="mb-3 text-[15px] font-bold text-ink">
                    Invite a colleague
                  </h3>
                  <p className="mb-3.5 text-sm text-ink-soft">
                    They&rsquo;ll get an email to set their password and sign
                    in as a dev_admin.
                  </p>

                  {error && (
                    <div className="mb-3.5 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
                      {error}
                    </div>
                  )}
                  {invited && (
                    <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                      Invite sent.
                    </div>
                  )}

                  <form action={inviteStaff} className="flex flex-col gap-3">
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="colleague@example.com"
                      className="rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Send invite
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {canSeeSetupSteps && (
          <details className="mt-9" open>
            <summary className="cursor-pointer font-display text-lg font-bold text-ink">
              Setup Tasks
            </summary>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                This is the checklist clients see in their portal. Edit it
                here &mdash; changes show up immediately, no code or redeploy
                needed.
              </p>
              <div className="flex items-center gap-2">
                {(
                  [
                    { value: "free", label: "View as Free" },
                    { value: "diy", label: "View as DIY" },
                    { value: "setup", label: "View as Setup" },
                  ] as const
                ).map((opt) => (
                  <Link
                    key={opt.value}
                    href={`/portal?previewAs=${opt.value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft"
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { value: "required", label: "Required" },
                  { value: "optional", label: "Optional Only" },
                  { value: "future", label: "Future Build Only" },
                  {
                    value: "optional_future",
                    label: "All Optional/Future Build",
                  },
                ] as const
              ).map((opt) => (
                <Link
                  key={opt.value}
                  href={opt.value === "required" ? "/profile" : `/profile?stepFilter=${opt.value}`}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    (stepFilter ?? "required") === opt.value
                      ? "bg-accent text-white"
                      : "border border-border text-ink-soft"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>

            {(() => {
              const path = "custom";
              const pathSteps = (steps ?? []).filter((s) => s.path === path);
              const phases = Array.from(
                new Set(pathSteps.map((s) => s.phase ?? "General")),
              );
              const sectionsByPhase: Record<string, string[]> = {};
              for (const phase of phases) {
                sectionsByPhase[phase] = Array.from(
                  new Set(
                    pathSteps
                      .filter((s) => (s.phase ?? "General") === phase)
                      .map((s) => s.section),
                  ),
                );
              }

              const visiblePathSteps = pathSteps.filter((s) => {
                if (stepFilter === "optional") return s.is_optional;
                if (stepFilter === "future") return s.is_future_build;
                if (stepFilter === "optional_future")
                  return s.is_optional || s.is_future_build;
                return !s.is_optional && !s.is_future_build;
              });
              const visiblePhases = phases.filter((phase) =>
                visiblePathSteps.some((s) => (s.phase ?? "General") === phase),
              );

              return (
                <section key={path} className="mt-6">
                  <h3 className="font-display text-base font-bold capitalize text-ink">
                    {path} path{" "}
                    <span className="text-sm font-normal text-ink-faint">
                      ({visiblePathSteps.length} of {pathSteps.length} steps)
                    </span>
                  </h3>

                  <div className="mt-3 flex flex-col gap-3">
                    {visiblePhases.map((phase) => {
                      const phaseSteps = visiblePathSteps.filter(
                        (s) => (s.phase ?? "General") === phase,
                      );
                      const sections = Array.from(
                        new Set(phaseSteps.map((s) => s.section)),
                      );

                      const rawPhase = phaseSteps[0]?.phase ?? "";

                      return (
                        <details
                          key={phase}
                          className="relative rounded-xl border border-border-soft bg-bg p-4"
                        >
                          <summary className="cursor-pointer pr-10 font-display text-base font-bold text-ink">
                            {phase}{" "}
                            <span className="ml-1.5 text-xs font-normal text-ink-faint">
                              ({phaseSteps.length})
                            </span>
                          </summary>

                          <form action={deletePillar} className="absolute right-4 top-4">
                            <input type="hidden" name="path" value={path} />
                            <input type="hidden" name="phase" value={rawPhase} />
                            <ConfirmSubmitButton
                              confirmMessage={`Delete the "${phase}" pillar and all ${phaseSteps.length} task(s) in it? This cannot be undone.`}
                              title={`Delete the ${phase} pillar`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-danger"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                              </svg>
                            </ConfirmSubmitButton>
                          </form>

                          {sections.map((section) => {
                            const sectionSteps = phaseSteps.filter(
                              (s) => s.section === section,
                            );

                            return (
                              <details key={section} className="relative mt-4">
                                <summary className="cursor-pointer pr-10 text-xs font-bold uppercase tracking-wide text-ink-faint">
                                  {section}{" "}
                                  <span className="ml-1.5 text-[10px] font-normal normal-case text-ink-faint">
                                    ({sectionSteps.length})
                                  </span>
                                </summary>

                                <form
                                  action={deleteSection}
                                  className="absolute right-0 top-0"
                                >
                                  <input type="hidden" name="path" value={path} />
                                  <input type="hidden" name="phase" value={rawPhase} />
                                  <input type="hidden" name="section" value={section} />
                                  <ConfirmSubmitButton
                                    confirmMessage={`Delete the "${section}" section and all ${sectionSteps.length} task(s) in it? This cannot be undone.`}
                                    title={`Delete the ${section} section`}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-danger"
                                  >
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                      <path d="M10 11v6" />
                                      <path d="M14 11v6" />
                                    </svg>
                                  </ConfirmSubmitButton>
                                </form>

                                <div className="mt-2">
                                  <SortableGroup
                                    items={sectionSteps.map((step) => ({
                                      id: step.id,
                                      node: (
                                        <StepEditPanel
                                          step={step}
                                          resources={resourcesByStep.get(step.id) ?? []}
                                          phases={phases}
                                          sectionsByPhase={sectionsByPhase}
                                        />
                                      ),
                                    }))}
                                    onReorder={reorderSteps}
                                  />
                                </div>
                              </details>
                            );
                          })}
                        </details>
                      );
                    })}
                  </div>

                  <details className="mt-3 rounded-xl border border-dashed border-border bg-bg p-5">
                    <summary className="cursor-pointer text-sm font-semibold text-accent">
                      + Add a task to the {path} path
                    </summary>
                    <form action={addStep} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input type="hidden" name="path" value={path} />
                      <label className="col-span-2 flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Key (unique, e.g. kickoff_call)
                        </span>
                        <input
                          name="key"
                          required
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <PhaseSectionPicker phases={phases} sectionsByPhase={sectionsByPhase} />
                      <LessonTypeFields defaultType="lesson" />
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Title
                        </span>
                        <input
                          name="title"
                          required
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Description
                        </span>
                        <MarkdownTextarea name="description" rows={2} />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Completed by
                        </span>
                        <select
                          name="completed_by"
                          defaultValue="diy"
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        >
                          <option value="diy">DIY</option>
                          <option value="setup">Setup</option>
                          <option value="both">Both</option>
                          <option value="staff">Staff</option>
                        </select>
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_optional" className="h-4 w-4" />
                          <span className="text-xs font-medium text-ink-soft">
                            Optional (can be done later)
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="is_future_build"
                            className="h-4 w-4"
                          />
                          <span className="text-xs font-medium text-ink-soft">
                            Future Build
                          </span>
                        </label>
                      </div>
                      <div className="col-span-2 flex items-end">
                        <button
                          type="submit"
                          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                        >
                          Add step
                        </button>
                      </div>
                    </form>
                  </details>
                </section>
              );
            })()}
          </details>
          )}

          <form action={signOut} className="mt-9">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink"
            >
              Sign Out
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </form>
        </main>
      </div>
    );
  }

  const { data: account } = profile?.client_account_id
    ? await supabase
        .from("client_accounts")
        .select("name")
        .eq("id", profile.client_account_id)
        .single()
    : { data: null };

  const { data: teammates } = profile?.client_account_id
    ? await supabase
        .from("profiles")
        .select("id, role, email, name, first_login_at")
        .eq("client_account_id", profile.client_account_id)
        .order("created_at")
    : { data: null };

  const businessName = account?.name ?? user.email ?? "Your business";

  const isOwner = profile?.role === "client_owner";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} />

      <div className="px-4 pt-6 sm:px-6 sm:pt-9 lg:px-12">
        <h1 className="font-display text-xl font-bold text-ink sm:text-[25px]">
          Profile
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {user.email} &middot; {CLIENT_ROLE_LABEL[profile?.role ?? ""]} at{" "}
          {businessName}
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 sm:pt-7 lg:flex-row lg:gap-8 lg:px-12 lg:pb-12">
        <section className="w-full rounded-xl border border-border bg-surface p-5 lg:w-[340px] lg:shrink-0">
          {saved && (
            <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
              Profile saved.
            </div>
          )}
          <form action={updateProfileInfo} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Name</span>
              <input
                name="name"
                defaultValue={profile?.name ?? ""}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Email</span>
              <input
                value={user.email ?? ""}
                disabled
                className="rounded-lg border border-border bg-border-soft px-3 py-2 text-sm text-ink-soft"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">
                Phone number
              </span>
              <input
                name="phone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </form>
        </section>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[15px] font-bold text-ink">Your team</h2>
            {(teammates ?? []).map((member) => (
              <Link
                key={member.id}
                href={`/profile/team/${member.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px] hover:border-accent"
              >
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-ink">
                    {member.name || "Pending"}
                    {member.id === user.id && (
                      <span className="ml-2 text-xs font-medium text-ink-faint">
                        (you)
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {CLIENT_ROLE_LABEL[member.role] ?? member.role}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                    member.first_login_at
                      ? "bg-success-soft text-success"
                      : "bg-accent-soft text-accent"
                  }`}
                >
                  {(member.first_login_at ? "active" : "invited").toUpperCase()}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-ink-faint"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}

            {(teammates ?? []).length === 0 && (
              <p className="text-sm text-ink-soft">No teammates yet.</p>
            )}
          </div>

          {isOwner && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-[15px] font-bold text-ink">
                Invite a teammate
              </h3>
              <p className="mb-3.5 text-sm text-ink-soft">
                They&rsquo;ll get an email to set their password and sign in
                as an admin on your account.
              </p>

              {error && (
                <div className="mb-3.5 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}
              {invited && (
                <div className="mb-3.5 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm text-success">
                  Invite sent.
                </div>
              )}

              <form action={inviteClientAdmin} className="flex flex-col gap-3">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="teammate@example.com"
                  className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Send invite
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-12 lg:pb-12">
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink"
          >
            Sign Out
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </main>
  );
}

function StepEditPanel({
  step,
  resources,
  phases,
  sectionsByPhase,
}: {
  step: SetupStep;
  resources: StepResource[];
  phases: string[];
  sectionsByPhase: Record<string, string[]>;
}) {
  return (
    <details className="rounded-xl border border-border bg-surface p-5">
      <summary className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 sm:block">
            <div className="text-[15px] font-bold text-ink">
              {step.title}
              {step.is_optional && (
                <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                  Optional
                </span>
              )}
              {step.is_future_build && (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                  Future Build
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:hidden">
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                {step.step_type}
              </span>
              <a
                href={stepClientHref(step)}
                target="_blank"
                rel="noopener noreferrer"
                title="View as the client sees it"
                aria-label="View as the client sees it"
                className="flex shrink-0 items-center justify-center rounded-lg border border-border px-2.5 py-2 text-ink"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </a>
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <CompletedByRadios stepId={step.id} value={step.completed_by} />
            <span className="text-ink-faint">|</span>
            <OptionalToggle stepId={step.id} value={step.is_optional} />
            <FutureBuildToggle stepId={step.id} value={step.is_future_build} />
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
            {step.step_type}
          </span>
          <a
            href={stepClientHref(step)}
            target="_blank"
            rel="noopener noreferrer"
            title="View as the client sees it"
            aria-label="View as the client sees it"
            className="flex shrink-0 items-center justify-center rounded-lg border border-border px-2.5 py-2 text-ink"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </a>
        </div>
      </summary>

      {step.instructions && (
        <details className="mt-4 rounded-lg border border-border-soft bg-bg p-3.5">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-ink-faint">
            Setup Instructions
          </summary>
          <div
            className="mt-3 text-sm leading-relaxed text-ink-soft
              [&_h1]:mt-3 [&_h1]:font-display [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-ink
              [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink
              [&_h3]:mt-2 [&_h3]:font-bold [&_h3]:text-ink
              [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
              [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
              [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
              [&_li]:mt-1 first:[&>*]:mt-0"
          >
            <ReactMarkdown>{step.instructions}</ReactMarkdown>
          </div>
        </details>
      )}

      <form
        id={`step-form-${step.id}`}
        action={updateStep}
        className="mt-4 grid grid-cols-1 gap-3 border-t border-border-soft pt-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={step.id} />
        <PhaseSectionPicker
          phases={phases}
          sectionsByPhase={sectionsByPhase}
          defaultPhase={step.phase ?? ""}
          defaultSection={step.section}
        />
        <LessonTypeFields
          defaultType={step.step_type}
          defaultLinkUrl={step.link_url}
          defaultVideoUrl={step.video_url}
          stepKey={step.key}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Title</span>
          <input
            name="title"
            defaultValue={step.title}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">
            Description
          </span>
          <MarkdownTextarea
            name="description"
            rows={2}
            defaultValue={step.description ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-ink-soft">
            Setup Instructions (what the setup team needs to do for this task)
          </span>
          <MarkdownTextarea
            name="instructions"
            rows={6}
            defaultValue={step.instructions ?? ""}
          />
        </label>
      </form>

      <div className="mt-4 flex flex-col items-stretch gap-4 border-t border-border-soft pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-ink-soft">
            Resource links
          </span>
          <div className="mt-2">
            <StepResourcesEditor stepId={step.id} initialResources={resources} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 sm:shrink-0">
          <SaveStepButton formId={`step-form-${step.id}`} />
          <form action={deleteStep}>
            <input type="hidden" name="id" value={step.id} />
            <ConfirmSubmitButton
              confirmMessage={`Delete the task "${step.title}"? This cannot be undone.`}
              title="Delete this task"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-danger"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </details>
  );
}
