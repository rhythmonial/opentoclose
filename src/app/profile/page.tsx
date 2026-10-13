import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { CompletedByRadios } from "@/components/CompletedByRadios";
import { PhaseSectionPicker } from "@/components/PhaseSectionPicker";
import { LessonTypeFields } from "@/components/LessonTypeFields";
import { StepResourcesEditor } from "@/components/StepResourcesEditor";
import { SortableGroup } from "@/components/dnd/SortableGroup";
import { signOut } from "@/app/login/actions";
import { updateProfileInfo, inviteClientAdmin, inviteStaff } from "./actions";
import {
  addStep,
  updateStep,
  deleteStep,
  reorderSteps,
} from "./setup-steps-actions";
import type { Tables } from "@/lib/supabase/types";
import { stepClientHref } from "@/lib/stepHref";

type SetupStep = Tables<"setup_steps">;
type StepResource = Tables<"setup_step_resources">;

const CLIENT_ROLE_LABEL: Record<string, string> = {
  client_owner: "Owner",
  client_admin: "Admin",
};

const STAFF_ROLE_LABEL: Record<string, string> = {
  dev: "Dev",
  dev_admin: "Dev Admin",
};

const PATHS = ["custom", "express"];

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
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
          .select("id, role, email, first_login_at")
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

    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <StaffNav />

        <main className="px-12 py-9">
          <h1 className="font-display text-[25px] font-bold text-ink">
            Profile
          </h1>

          <section className="mt-7 max-w-md rounded-xl border border-border bg-surface p-5">
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

          <div className="mt-7 flex gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <h2 className="text-[15px] font-bold text-ink">
                Internal team
              </h2>
              {(staff ?? []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px]"
                >
                  <div className="flex-1">
                    <div className="text-[15px] font-bold text-ink">
                      {member.email ?? "Pending"}
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
                </div>
              ))}
            </div>

            {canInvite && (
              <div className="flex w-[340px] shrink-0 flex-col gap-5">
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

          <details className="mt-9">
            <summary className="cursor-pointer font-display text-lg font-bold text-ink">
              Setup Steps
            </summary>

            <p className="mt-1.5 text-sm text-ink-soft">
              This is the checklist clients see in their portal. Edit it here
              &mdash; changes show up immediately, no code or redeploy
              needed.
            </p>

            {PATHS.map((path) => {
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

              return (
                <section key={path} className="mt-6">
                  <h3 className="font-display text-base font-bold capitalize text-ink">
                    {path} path{" "}
                    <span className="text-sm font-normal text-ink-faint">
                      ({pathSteps.length} steps)
                    </span>
                  </h3>

                  <div className="mt-3 flex flex-col gap-3">
                    {phases.map((phase) => {
                      const phaseSteps = pathSteps.filter(
                        (s) => (s.phase ?? "General") === phase,
                      );
                      const sections = Array.from(
                        new Set(phaseSteps.map((s) => s.section)),
                      );

                      return (
                        <details
                          key={phase}
                          className="rounded-xl border border-border-soft bg-bg p-4"
                        >
                          <summary className="cursor-pointer font-display text-base font-bold text-ink">
                            {phase}{" "}
                            <span className="ml-1.5 text-xs font-normal text-ink-faint">
                              ({phaseSteps.length})
                            </span>
                          </summary>

                          {sections.map((section) => {
                            const sectionSteps = phaseSteps.filter(
                              (s) => s.section === section,
                            );

                            return (
                              <div key={section} className="mt-4">
                                <h4 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                                  {section}
                                </h4>
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
                              </div>
                            );
                          })}
                        </details>
                      );
                    })}
                  </div>

                  <details className="mt-3 rounded-xl border border-dashed border-border bg-bg p-5">
                    <summary className="cursor-pointer text-sm font-semibold text-accent">
                      + Add a step to the {path} path
                    </summary>
                    <form action={addStep} className="mt-4 grid grid-cols-2 gap-3">
                      <input type="hidden" name="path" value={path} />
                      <label className="flex flex-col gap-1.5">
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
                      <LessonTypeFields defaultType="lesson">
                        <label className="flex items-end gap-2 pb-2.5">
                          <input type="checkbox" name="is_optional" className="h-4 w-4" />
                          <span className="text-xs font-medium text-ink-soft">
                            Optional (can be done later)
                          </span>
                        </label>
                      </LessonTypeFields>
                      <label className="col-span-2 flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Title
                        </span>
                        <input
                          name="title"
                          required
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <label className="col-span-2 flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Description
                        </span>
                        <textarea
                          name="description"
                          rows={2}
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                          Completed by
                        </span>
                        <select
                          name="completed_by"
                          defaultValue="client"
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        >
                          <option value="client">Client</option>
                          <option value="staff">Staff (Setup only)</option>
                          <option value="staff_always">Staff (always)</option>
                        </select>
                      </label>
                      <div className="flex items-end">
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
            })}
          </details>

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
        .select("id, role, email, first_login_at")
        .eq("client_account_id", profile.client_account_id)
        .order("created_at")
    : { data: null };

  const businessName = account?.name ?? user.email ?? "Your business";

  const isOwner = profile?.role === "client_owner";

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav businessName={businessName} />

      <div className="px-12 pt-9">
        <h1 className="font-display text-[25px] font-bold text-ink">
          Profile
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {user.email} &middot; {CLIENT_ROLE_LABEL[profile?.role ?? ""]} at{" "}
          {businessName}
        </p>
      </div>

      <div className="flex gap-8 px-12 pb-12 pt-7">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h2 className="text-[15px] font-bold text-ink">Your team</h2>
          {(teammates ?? []).map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-[18px]"
            >
              <div className="flex-1">
                <div className="text-[15px] font-bold text-ink">
                  {member.email ?? "Pending"}
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
            </div>
          ))}

          {(teammates ?? []).length === 0 && (
            <p className="text-sm text-ink-soft">No teammates yet.</p>
          )}
        </div>

        {isOwner && (
          <div className="flex w-[340px] shrink-0 flex-col gap-5">
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
          </div>
        )}
      </div>

      <div className="px-12 pb-12">
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
      <summary className="flex cursor-pointer items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-[15px] font-bold text-ink">
            {step.title}
            {step.is_optional && (
              <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                Optional
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <CompletedByRadios stepId={step.id} value={step.completed_by} />
          </div>
        </div>
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
      </summary>

      <form
        action={updateStep}
        className="mt-4 grid grid-cols-2 gap-3 border-t border-border-soft pt-4"
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
        >
          <label className="flex items-end gap-2 pb-2.5">
            <input
              type="checkbox"
              name="is_optional"
              defaultChecked={step.is_optional}
              className="h-4 w-4"
            />
            <span className="text-xs font-medium text-ink-soft">
              Optional (can be done later)
            </span>
          </label>
        </LessonTypeFields>
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Title</span>
          <input
            name="title"
            defaultValue={step.title}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">
            Description
          </span>
          <textarea
            name="description"
            rows={2}
            defaultValue={step.description ?? ""}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="col-span-2 flex items-end gap-2">
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </form>

      <div className="mt-4 border-t border-border-soft pt-4">
        <span className="text-xs font-medium text-ink-soft">
          Resource links
        </span>
        <div className="mt-2">
          <StepResourcesEditor stepId={step.id} initialResources={resources} />
        </div>
      </div>

      <form action={deleteStep} className="mt-3">
        <input type="hidden" name="id" value={step.id} />
        <button type="submit" className="text-xs font-medium text-danger">
          Delete this step
        </button>
      </form>
    </details>
  );
}
