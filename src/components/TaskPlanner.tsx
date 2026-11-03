"use client";

import { Fragment, useRef, useState } from "react";
import {
  missingFor,
  SIDES,
  TASK_COMPLETED,
  TASK_TIME_FRAMES,
  TIMINGS,
  type PlannedTask,
  type TaskSide,
} from "@/lib/taskPlans";
import { SAMPLE_TASKS } from "@/lib/sampleTasks";
import {
  addSampleTasks,
  deleteTask,
  renameTemplate,
  saveTask,
} from "@/app/configurator/plan_your_task_templates/actions";

type Row = PlannedTask & { key: string };

const cellInput =
  "w-full rounded-md border bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-accent";

// Plan Your Task Templates: per side (Buyer "B -", Seller "S -", Listing
// "L -"), templates of tasks laid out like the task setup prep sheet: name,
// critical, recurring, notes, then when it's due (days, time frame, before
// / after / same day as, which date field, or when a parent task is done).
// A side can start from TC Optimize's sample tasks.
export function TaskPlanner({
  accountId,
  initial,
  dateOptions,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  initial: PlannedTask[];
  dateOptions: string[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((t) => ({ ...t, key: t.id ?? crypto.randomUUID() })),
  );
  const [side, setSide] = useState<TaskSide>("buyer");
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, number>());

  const sideInfo = SIDES.find((s) => s.value === side)!;
  const sideRows = rows.filter((r) => r.side === side);
  const templates = [...new Set(sideRows.map((r) => r.template))];
  const taskNames = [...new Set(sideRows.map((r) => r.name).filter(Boolean))];
  const dateFieldList = [TASK_COMPLETED, ...new Set([...dateOptions, ...rows.map((r) => r.dateField)])]
    .filter((d, i, all) => d && all.indexOf(d) === i);
  const incomplete = sideRows.filter((r) => missingFor(r).length > 0).length;

  function report(ok: boolean, message?: string) {
    setStatus(ok ? "saved" : "error");
    setError(ok ? null : (message ?? "Couldn't save."));
  }

  function update(key: string, change: Partial<PlannedTask>) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const next = { ...row, ...change };
    setRows((all) => all.map((r) => (r.key === key ? next : r)));
    if (!next.id) return;
    const old = timers.current.get(key);
    if (old) window.clearTimeout(old);
    setStatus("saving");
    timers.current.set(
      key,
      window.setTimeout(async () => {
        timers.current.delete(key);
        const result = await saveTask(accountId, next);
        report(result.ok, result.error);
      }, 500),
    );
  }

  async function addTask(template: string) {
    const last = Math.max(0, ...sideRows.map((r) => r.sortOrder));
    const task: PlannedTask = {
      id: null,
      side,
      template,
      name: "New task",
      notes: "",
      critical: false,
      recurring: false,
      dueDays: null,
      timeFrame: null,
      timing: null,
      dateField: "",
      parentTask: "",
      sortOrder: last + 1,
    };
    setStatus("saving");
    const result = await saveTask(accountId, task);
    report(result.ok, result.error);
    if (result.ok && result.id) {
      setRows((all) => [...all, { ...task, id: result.id!, key: result.id! }]);
    }
  }

  async function remove(row: Row) {
    setRows((all) => all.filter((r) => r.key !== row.key));
    if (row.id) await deleteTask(accountId, row.id);
  }

  async function startFromSamples() {
    setBusy(true);
    const result = await addSampleTasks(accountId, side);
    setBusy(false);
    report(result.ok, result.error);
    if (result.ok && result.tasks) {
      setRows((all) => [...all, ...result.tasks!.map((t) => ({ ...t, key: t.id! }))]);
    }
  }

  async function rename(from: string, to: string) {
    const name = to.trim();
    if (!name || name === from) return;
    setRows((all) =>
      all.map((r) => (r.side === side && r.template === from ? { ...r, template: name } : r)),
    );
    const result = await renameTemplate(accountId, side, from, name);
    report(result.ok, result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <datalist id="task-date-fields">
        {dateFieldList.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <datalist id={`task-names-${side}`}>
        {taskNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist">
          {SIDES.map((s) => {
            const n = rows.filter((r) => r.side === s.value).length;
            return (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={side === s.value}
                onClick={() => setSide(s.value)}
                className={`rounded-lg border px-4 py-1.5 text-sm font-semibold ${
                  side === s.value
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-ink-soft hover:border-accent"
                }`}
              >
                {s.label} <span className="opacity-70">({s.prefix})</span>
                {n > 0 && <span className="ml-1 opacity-80">&middot; {n}</span>}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-ink-faint">
          {sideRows.length} task{sideRows.length === 1 ? "" : "s"} in {templates.length} template
          {templates.length === 1 ? "" : "s"}
          {incomplete > 0 && (
            <span className="font-semibold text-danger"> &middot; {incomplete} to finish</span>
          )}
          {status === "saving" && " · Saving…"}
          {status === "saved" && " · Saved"}
          {status === "error" && <span className="text-danger"> · {error}</span>}
        </span>
      </div>

      {sideRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-ink-soft">
            No {sideInfo.label.toLowerCase()} tasks yet. Start from our {SAMPLE_TASKS.length}{" "}
            sample tasks (in General, Loan, Inspection, Termite and Home Warranty templates)
            and make them yours, or start from scratch.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={startFromSamples}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Adding…" : "Start with the sample tasks"}
            </button>
            <button
              type="button"
              onClick={() => addTask("General")}
              className="rounded-lg border border-border px-5 py-2 text-sm font-semibold text-ink-soft"
            >
              Start from scratch
            </button>
          </div>
        </div>
      ) : (
        <>
          {templates.map((template) => {
            const items = sideRows
              .filter((r) => r.template === template)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <section key={template} className="rounded-xl border border-border bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                  <TemplateName
                    prefix={sideInfo.prefix}
                    name={template}
                    onRename={(to) => rename(template, to)}
                  />
                  <span className="text-xs text-ink-faint">
                    {items.length} task{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[78rem] table-fixed text-left text-sm">
                    <colgroup>
                      <col />
                      <col className="w-12" />
                      <col className="w-12" />
                      <col className="w-[4.5rem]" />
                      <col className="w-40" />
                      <col className="w-36" />
                      <col className="w-48" />
                      <col className="w-48" />
                      <col className="w-24" />
                    </colgroup>
                    <thead className="bg-bg text-xs text-ink-soft">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Task Name*</th>
                        <th className="px-1 py-2 text-center font-semibold" title="Critical">Crit.</th>
                        <th className="px-1 py-2 text-center font-semibold" title="Recurring">Recur</th>
                        <th className="px-1 py-2 font-semibold">Days*</th>
                        <th className="px-1 py-2 font-semibold">Time Frame</th>
                        <th className="px-1 py-2 font-semibold">When*</th>
                        <th className="px-1 py-2 font-semibold">Date Field*</th>
                        <th className="px-1 py-2 font-semibold">Parent Task</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((r) => {
                        const missing = missingFor(r);
                        const bad = (field: string) =>
                          missing.includes(field) ? "border-danger/60" : "border-border";
                        const sameDay = r.timing === "same_day";
                        const notesOpen = openNotes.has(r.key);
                        return (
                          <Fragment key={r.key}>
                            <tr className="align-top">
                              <td className="px-2 py-1.5">
                                <input
                                  value={r.name}
                                  onChange={(e) => update(r.key, { name: e.target.value })}
                                  aria-label="Task name"
                                  title={r.name}
                                  className={`${cellInput} ${bad("a name")}`}
                                />
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={r.critical}
                                  onChange={(e) => update(r.key, { critical: e.target.checked })}
                                  aria-label="Critical"
                                  className="mt-1.5"
                                />
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={r.recurring}
                                  onChange={(e) => update(r.key, { recurring: e.target.checked })}
                                  aria-label="Recurring"
                                  className="mt-1.5"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={sameDay}
                                  value={sameDay ? "" : (r.dueDays ?? "")}
                                  onChange={(e) =>
                                    update(r.key, {
                                      dueDays:
                                        e.target.value === ""
                                          ? null
                                          : Math.max(0, Math.trunc(Number(e.target.value))),
                                    })
                                  }
                                  aria-label="Due days"
                                  className={`${cellInput} disabled:opacity-40 ${bad("days")}`}
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <select
                                  value={r.timeFrame ?? ""}
                                  disabled={sameDay}
                                  onChange={(e) =>
                                    update(r.key, {
                                      timeFrame: (e.target.value || null) as PlannedTask["timeFrame"],
                                    })
                                  }
                                  aria-label="Time frame"
                                  className={`${cellInput} border-border disabled:opacity-40`}
                                >
                                  <option value="">&mdash;</option>
                                  {TASK_TIME_FRAMES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-1 py-1.5">
                                <select
                                  value={r.timing ?? ""}
                                  onChange={(e) =>
                                    update(r.key, {
                                      timing: (e.target.value || null) as PlannedTask["timing"],
                                    })
                                  }
                                  aria-label="When"
                                  className={`${cellInput} ${bad("when")}`}
                                >
                                  <option value="">Choose&hellip;</option>
                                  {TIMINGS.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  list="task-date-fields"
                                  value={r.dateField}
                                  onChange={(e) => update(r.key, { dateField: e.target.value })}
                                  placeholder="Choose or type"
                                  aria-label="Date field"
                                  title={r.dateField}
                                  className={`${cellInput} ${bad("a date field")}`}
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  list={`task-names-${side}`}
                                  value={r.parentTask}
                                  onChange={(e) => update(r.key, { parentTask: e.target.value })}
                                  placeholder={r.dateField === TASK_COMPLETED ? "Required" : ""}
                                  aria-label="Parent task"
                                  title={r.parentTask}
                                  className={`${cellInput} ${bad("a parent task")}`}
                                />
                              </td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenNotes((all) => {
                                      const next = new Set(all);
                                      if (next.has(r.key)) next.delete(r.key);
                                      else next.add(r.key);
                                      return next;
                                    })
                                  }
                                  title="Notes"
                                  className={`mr-2 text-xs font-semibold ${r.notes ? "text-accent" : "text-ink-faint"} hover:text-accent`}
                                >
                                  Notes{r.notes ? " •" : ""}
                                </button>
                                <ConfirmDelete onConfirm={() => remove(r)} />
                              </td>
                            </tr>
                            {notesOpen && (
                              <tr>
                                <td colSpan={9} className="px-2 pb-2">
                                  <textarea
                                    value={r.notes}
                                    onChange={(e) => update(r.key, { notes: e.target.value })}
                                    rows={2}
                                    placeholder="Notes for whoever does this task"
                                    aria-label="Notes"
                                    className={`${cellInput} border-border`}
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => addTask(template)}
                    className="text-xs font-semibold text-accent"
                  >
                    + Add task
                  </button>
                </div>
              </section>
            );
          })}

          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newTemplate.trim();
              if (!name) return;
              setNewTemplate("");
              void addTask(name);
            }}
          >
            <span className="text-sm font-semibold text-ink-soft">{sideInfo.prefix}</span>
            <input
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              maxLength={80}
              placeholder="New template name, e.g. HOA"
              aria-label="New template name"
              className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newTemplate.trim()}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add template
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function TemplateName({
  prefix,
  name,
  onRename,
}: {
  prefix: string;
  name: string;
  onRename: (to: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  return editing ? (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onRename(value);
        setEditing(false);
      }}
    >
      <span className="font-semibold text-ink">{prefix}</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={80}
        aria-label="Template name"
        className="rounded-md border border-border bg-bg px-2 py-0.5 text-sm text-ink outline-none focus:border-accent"
      />
      <button type="submit" className="text-xs font-semibold text-accent">
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setEditing(false);
        }}
        className="text-xs font-semibold text-ink-soft"
      >
        Cancel
      </button>
    </form>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename this template"
      className="font-display text-base font-bold text-ink hover:text-accent"
    >
      {prefix} {name}
    </button>
  );
}

function ConfirmDelete({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <button
      type="button"
      onClick={onConfirm}
      onBlur={() => setArmed(false)}
      className="rounded bg-danger px-1.5 py-0.5 text-[11px] font-semibold text-white"
    >
      Delete?
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setArmed(true)}
      aria-label="Delete task"
      title="Delete task"
      className="align-middle text-ink-faint hover:text-danger"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  );
}
