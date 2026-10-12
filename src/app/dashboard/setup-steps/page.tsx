import { createClient } from "@/lib/supabase/server";
import { addStep, updateStep, deleteStep } from "./actions";

const STEP_TYPES = ["video", "configurator", "download", "external_link", "form"];
const PATHS = ["custom", "express"];

export default async function SetupStepsPage() {
  const supabase = await createClient();
  const { data: steps } = await supabase
    .from("setup_steps")
    .select("*")
    .order("path")
    .order("sort_order");

  return (
    <main className="px-12 py-9">
      <h1 className="font-display text-[25px] font-bold text-ink">
        Setup Steps
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        This is the checklist clients see in their portal. Edit it here —
        changes show up immediately, no code or redeploy needed.
      </p>

      {PATHS.map((path) => (
        <section key={path} className="mt-8">
          <h2 className="font-display text-lg font-bold capitalize text-ink">
            {path} path
          </h2>

          <div className="mt-3 flex flex-col gap-3">
            {(steps ?? [])
              .filter((s) => s.path === path)
              .map((step) => (
                <details
                  key={step.id}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                        {step.section}
                      </span>
                      <div className="text-[15px] font-bold text-ink">
                        {step.sort_order}. {step.title}
                      </div>
                    </div>
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                      {step.step_type}
                    </span>
                  </summary>

                  <form
                    action={updateStep}
                    className="mt-4 grid grid-cols-2 gap-3 border-t border-border-soft pt-4"
                  >
                    <input type="hidden" name="id" value={step.id} />
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-soft">
                        Section
                      </span>
                      <input
                        name="section"
                        defaultValue={step.section}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-soft">
                        Sort order
                      </span>
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={step.sort_order}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <label className="col-span-2 flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-soft">
                        Title
                      </span>
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
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-ink-soft">
                        Type
                      </span>
                      <select
                        name="step_type"
                        defaultValue={step.step_type}
                        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                      >
                        {STEP_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
                      >
                        Save
                      </button>
                    </div>
                  </form>

                  <form action={deleteStep} className="mt-2">
                    <input type="hidden" name="id" value={step.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-danger"
                    >
                      Delete this step
                    </button>
                  </form>
                </details>
              ))}
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
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  Sort order
                </span>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={0}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  Section
                </span>
                <input
                  name="section"
                  required
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </label>
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
                  Type
                </span>
                <select
                  name="step_type"
                  defaultValue="video"
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
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
      ))}
    </main>
  );
}
