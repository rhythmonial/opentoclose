import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { CompletedByRadios } from "@/components/CompletedByRadios";
import { OptionalToggle } from "@/components/OptionalToggle";
import { FutureBuildToggle } from "@/components/FutureBuildToggle";
import { PhaseSectionPicker } from "@/components/PhaseSectionPicker";
import { LessonTypeFields } from "@/components/LessonTypeFields";
import { MarkdownTextarea } from "@/components/MarkdownTextarea";
import { SaveStepButton } from "@/components/SaveStepButton";
import { StepResourcesEditor } from "@/components/StepResourcesEditor";
import { SortableGroup } from "@/components/dnd/SortableGroup";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { MoveSectionSelect } from "@/components/MoveSectionSelect";
import { MoveStepSelect, type SectionTarget } from "@/components/MoveStepSelect";
import { PublishToggle } from "@/components/PublishToggle";
import { RenameButton } from "@/components/RenameButton";
import { startSandbox } from "@/app/dashboard/sandbox-actions";
import {
  addStep,
  updateStep,
  deleteStep,
  deletePillar,
  deleteSection,
  reorderSteps,
  updateHourlyRate,
  movePillar,
  moveSectionOrder,
} from "@/app/profile/setup-steps-actions";
import type { Tables } from "@/lib/supabase/types";
import { stepClientHref } from "@/lib/stepHref";
import { getHourlyRate } from "@/lib/hourlyRate";

type SetupStep = Tables<"setup_steps">;
type StepResource = Tables<"setup_step_resources">;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ stepFilter?: string }>;
}) {
  const { stepFilter } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "dev") {
    redirect("/dashboard");
  }

  const [{ data: steps }, { data: resources }] = await Promise.all([
    supabase.from("setup_steps").select("*").order("path").order("sort_order"),
    supabase.from("setup_step_resources").select("*").order("sort_order"),
  ]);

  const resourcesByStep = new Map<string, StepResource[]>();
  for (const r of resources ?? []) {
    const list = resourcesByStep.get(r.step_id) ?? [];
    list.push(r);
    resourcesByStep.set(r.step_id, list);
  }

  const hourlyRate = await getHourlyRate();

  return (
    <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
          Setup Tasks
        </h1>
        <form
          action={updateHourlyRate}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <label htmlFor="hourly_rate" className="text-xs font-medium text-ink-soft">
            Done-for-you rate
          </label>
          <span className="text-sm text-ink">$</span>
          <input
            id="hourly_rate"
            name="hourly_rate"
            type="number"
            min="1"
            step="0.01"
            required
            defaultValue={hourlyRate}
            className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-accent"
          />
          <span className="text-sm text-ink-soft">/hr</span>
          <button
            type="submit"
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white"
          >
            Save
          </button>
        </form>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          This is the checklist clients see in their portal. Edit it here
          &mdash; changes show up immediately, no code or redeploy needed.
        </p>
        <div className="flex items-center gap-2">
          {(
            [
              { value: "free", label: "View as Free" },
              { value: "diy", label: "View as DIY" },
              { value: "custom", label: "View as Setup" },
            ] as const
          ).map((opt) => (
            <form key={opt.value} action={startSandbox}>
              <input type="hidden" name="tier" value={opt.value} />
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft"
              >
                {opt.label}
              </button>
            </form>
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
            href={
              opt.value === "required"
                ? "/dashboard/tasks"
                : `/dashboard/tasks?stepFilter=${opt.value}`
            }
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
        const phaseOptions = Array.from(
          new Set(pathSteps.map((s) => s.phase ?? "")),
        ).map((value) => ({ value, label: value || "General" }));
        const sectionTargets: SectionTarget[] = [];
        for (const s of pathSteps) {
          const phase = s.phase ?? "";
          if (
            !sectionTargets.some(
              (t) => t.phase === phase && t.section === s.section,
            )
          ) {
            sectionTargets.push({
              phase,
              phaseLabel: phase || "General",
              section: s.section,
            });
          }
        }
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
              {visiblePhases.map((phase, phasePosition) => {
                const phaseSteps = visiblePathSteps.filter(
                  (s) => (s.phase ?? "General") === phase,
                );
                const sections = Array.from(
                  new Set(phaseSteps.map((s) => s.section)),
                );

                const rawPhase = phaseSteps[0]?.phase ?? "";
                const phaseIndex = phases.indexOf(phase);

                return (
                  // Keyed by position so renaming a pillar or section keeps
                  // it open instead of remounting it.
                  <div key={phasePosition} className="relative">
                  <details className="rounded-xl border border-border-soft bg-bg p-4">
                    <summary className="cursor-pointer pr-32 font-display text-base font-bold text-ink">
                      <RenameButton
                        kind="pillar"
                        path={path}
                        phase={rawPhase}
                        currentName={phase}
                        siblingNames={phaseOptions
                          .map((o) => o.value)
                          .filter((v) => v && v !== rawPhase)}
                      />
                      <span className="ml-1.5 text-xs font-normal text-ink-faint">
                        ({phaseSteps.length})
                      </span>
                    </summary>


                    {sections.map((section, sectionPosition) => {
                      const sectionSteps = phaseSteps.filter(
                        (s) => s.section === section,
                      );
                      const pillarSections = sectionsByPhase[phase] ?? [];
                      const sectionIndex = pillarSections.indexOf(section);

                      return (
                        <div key={sectionPosition} className="relative mt-4">
                        <details>
                          <summary className="cursor-pointer pr-44 text-xs font-bold uppercase font-caption leading-7 tracking-wide text-ink-faint">
                            <RenameButton
                              kind="section"
                              path={path}
                              phase={rawPhase}
                              section={section}
                              currentName={section}
                              siblingNames={pillarSections.filter(
                                (n) => n !== section,
                              )}
                            />
                            <span className="ml-1.5 text-[10px] font-normal normal-case text-ink-faint">
                              ({sectionSteps.length})
                            </span>
                          </summary>


                          <div className="mt-2">
                            <SortableGroup
                              items={sectionSteps.map((step) => ({
                                id: step.id,
                                node: (
                                  <StepEditPanel
                                    step={step}
                                    resources={
                                      resourcesByStep.get(step.id) ?? []
                                    }
                                    sectionTargets={sectionTargets}
                                  />
                                ),
                              }))}
                              onReorder={reorderSteps}
                            />
                          </div>
                        </details>
                          <div className="absolute right-0 top-0 flex items-center gap-2">
                            <MoveSectionSelect
                              path={path}
                              fromPhase={rawPhase}
                              section={section}
                              phases={phaseOptions}
                            />
                            <form action={moveSectionOrder}>
                              <input type="hidden" name="path" value={path} />
                              <input type="hidden" name="phase" value={rawPhase} />
                              <input type="hidden" name="section" value={section} />
                              <input type="hidden" name="direction" value="up" />
                              <button
                                type="submit"
                                disabled={sectionIndex <= 0}
                                title={`Move ${section} up`}
                                aria-label={`Move ${section} up`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-ink-soft hover:text-ink disabled:opacity-30"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m18 15-6-6-6 6" />
                                </svg>
                              </button>
                            </form>
                            <form action={moveSectionOrder}>
                              <input type="hidden" name="path" value={path} />
                              <input type="hidden" name="phase" value={rawPhase} />
                              <input type="hidden" name="section" value={section} />
                              <input type="hidden" name="direction" value="down" />
                              <button
                                type="submit"
                                disabled={sectionIndex === pillarSections.length - 1}
                                title={`Move ${section} down`}
                                aria-label={`Move ${section} down`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-ink-soft hover:text-ink disabled:opacity-30"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              </button>
                            </form>
                            <form action={deleteSection}>
                            <input type="hidden" name="path" value={path} />
                            <input
                              type="hidden"
                              name="phase"
                              value={rawPhase}
                            />
                            <input
                              type="hidden"
                              name="section"
                              value={section}
                            />
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
                          </div>
                        </div>
                      );
                    })}
                  </details>
                    <div className="absolute right-4 top-4 flex items-center gap-1.5">
                      <form action={movePillar}>
                        <input type="hidden" name="path" value={path} />
                        <input type="hidden" name="phase" value={rawPhase} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={phaseIndex === 0}
                          title={`Move ${phase} up`}
                          aria-label={`Move ${phase} up`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-soft hover:text-ink disabled:opacity-30"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m18 15-6-6-6 6" />
                          </svg>
                        </button>
                      </form>
                      <form action={movePillar}>
                        <input type="hidden" name="path" value={path} />
                        <input type="hidden" name="phase" value={rawPhase} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={phaseIndex === phases.length - 1}
                          title={`Move ${phase} down`}
                          aria-label={`Move ${phase} down`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-soft hover:text-ink disabled:opacity-30"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      </form>
                      <form action={deletePillar}>
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
                    </div>
                  </div>
                );
              })}
            </div>

            <details className="mt-3 rounded-xl border border-dashed border-border bg-bg p-5">
              <summary className="cursor-pointer text-sm font-semibold text-accent">
                + Add a task to the {path} path
              </summary>
              <form
                action={addStep}
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
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
                <PhaseSectionPicker
                  phases={phases}
                  sectionsByPhase={sectionsByPhase}
                />
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
                    <input
                      type="checkbox"
                      name="is_optional"
                      className="h-4 w-4"
                    />
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
    </main>
  );
}

function StepEditPanel({
  step,
  resources,
  sectionTargets,
}: {
  step: SetupStep;
  resources: StepResource[];
  sectionTargets: SectionTarget[];
}) {
  const moveSelect = (
    <MoveStepSelect
      stepId={step.id}
      stepTitle={step.title}
      currentPhase={step.phase ?? ""}
      currentSection={step.section}
      targets={sectionTargets}
    />
  );

  return (
    <details className="rounded-lg border border-border bg-surface px-4 py-2 open:pb-4">
      <summary className="flex cursor-pointer flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 lg:flex lg:items-center lg:gap-5">
          <div className="flex items-start justify-between gap-3 sm:block">
            <div className="text-sm font-bold text-ink">
              <RenameButton
                kind="lesson"
                stepId={step.id}
                currentName={step.title}
              />
              <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-[10px] font-bold uppercase font-caption tracking-wide text-accent">
                {step.step_type}
              </span>
              {step.is_optional && (
                <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold uppercase font-caption tracking-wide text-ink-faint">
                  Optional
                </span>
              )}
              {step.is_future_build && (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase font-caption tracking-wide text-accent">
                  Future Build
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:hidden">
              {moveSelect}
              <PublishToggle stepId={step.id} value={step.is_published} />
              <a
                href={stepClientHref(step)}
                target="_blank"
                rel="noopener noreferrer"
                title="View as the client sees it"
                aria-label="View as the client sees it"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-ink"
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
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] lg:mt-0">
            <CompletedByRadios stepId={step.id} value={step.completed_by} />
            <span className="text-ink-faint">|</span>
            <OptionalToggle stepId={step.id} value={step.is_optional} />
            <FutureBuildToggle stepId={step.id} value={step.is_future_build} />
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {moveSelect}
          <PublishToggle stepId={step.id} value={step.is_published} />
          <a
            href={stepClientHref(step)}
            target="_blank"
            rel="noopener noreferrer"
            title="View as the client sees it"
            aria-label="View as the client sees it"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-ink"
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
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </a>
        </div>
      </summary>

      {step.instructions && (
        <details className="mt-4 rounded-lg border border-border-soft bg-bg p-3.5">
          <summary className="cursor-pointer text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
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
        className="mt-3 grid grid-cols-1 gap-3 border-t border-border-soft pt-3 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={step.id} />
        <LessonTypeFields
          defaultType={step.step_type}
          defaultLinkUrl={step.link_url}
          defaultVideoUrl={step.video_url}
          stepKey={step.key}
          showVideoUrl={false}
        />
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-ink-soft">Description</span>
          <MarkdownTextarea
            name="description"
            rows={3}
            defaultValue={step.description ?? ""}
          />
        </label>
      </form>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.step_type === "lesson" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Video URL</span>
            <input
              form={`step-form-${step.id}`}
              name="video_url"
              defaultValue={step.video_url ?? ""}
              placeholder="https://..."
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
        )}
        <div className="min-w-0">
          <span className="text-xs font-medium text-ink-soft">
            Resource links
          </span>
          <div className="mt-1.5">
            <StepResourcesEditor
              stepId={step.id}
              initialResources={resources}
            />
          </div>
        </div>
      </div>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">
          Setup Instructions (what the setup team needs to do for this task)
        </span>
        <MarkdownTextarea
          name="instructions"
          rows={6}
          defaultValue={step.instructions ?? ""}
          form={`step-form-${step.id}`}
        />
      </label>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border-soft pt-3">
          <SaveStepButton formId={`step-form-${step.id}`} />
          <form action={deleteStep}>
            <input type="hidden" name="id" value={step.id} />
            <ConfirmSubmitButton
              confirmMessage={`Delete the task "${step.title}"? This cannot be undone.`}
              title="Delete this task"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-danger"
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
      </div>
    </details>
  );
}
