"use client";

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import {
  missingFor,
  SIDES,
  TASK_TIME_FRAMES,
  TIMINGS,
  type PlannedTask,
  type SideInfo,
  type TaskSide,
} from "@/lib/taskPlans";
import { SAMPLE_TASKS } from "@/lib/sampleTasks";
import {
  addSampleTasks,
  addSide,
  deleteTask,
  removeSide,
  renameTemplate,
  saveTask,
} from "@/app/configurator/plan_your_task_templates/actions";

type Row = PlannedTask & { key: string };

// Date Field choices under a heading (an OTC section, or the client's own).
export type DateGroup = { section: string; names: string[] };

const cellInput =
  "w-full rounded-md border bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-accent";

// Plan Your Task Templates: per side (Buyer "B -", Seller "S -", Listing
// "L -", and any task list the client adds with "+"), templates of tasks laid out like the task setup prep sheet: name,
// critical, recurring (every so many days), notes, then when it's due (days,
// time frame, before / after / same day as a date field, or its parent task
// in the same template; one or the other), before
// / after / same day as, which date field, or when a parent task is done).
// A side can start from TC Optimize's sample tasks.
export function TaskPlanner({
  accountId,
  initial,
  dateGroups,
  customSides,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  initial: PlannedTask[];
  // Every date a task can be due from.
  dateGroups: DateGroup[];
  // Task lists the client added beside Buyer, Seller and Listing.
  customSides: SideInfo[];
}) {
  const dateOptions = dateGroups.flatMap((g) => g.names);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((t) => ({ ...t, key: t.id ?? crypto.randomUUID() })),
  );
  const [side, setSide] = useState<TaskSide>("buyer");
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, number>());
  const [added, setAdded] = useState<SideInfo[]>(customSides);
  // The "+" form for a new task list: null when closed.
  const [newSide, setNewSide] = useState<{
    label: string;
    prefix: string;
    edited: boolean;
  } | null>(null);

  const sides = [...SIDES, ...added];
  const sideInfo = sides.find((s) => s.value === side) ?? SIDES[0];
  const sideRows = rows.filter((r) => r.side === side);
  const templates = [...new Set(sideRows.map((r) => r.template))];

  const incomplete = sideRows.filter((r) => missingFor(r).length > 0).length;
  const offList = sideRows.filter(
    (r) => r.dateField && !dateOptions.includes(r.dateField),
  ).length;

  function report(ok: boolean, message?: string) {
    setStatus(ok ? "saved" : "error");
    setError(ok ? null : (message ?? "Couldn't save."));
  }

  function update(key: string, change: Partial<PlannedTask>) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const changed: Row[] = [{ ...row, ...change }];
    // Renaming a task keeps the tasks it's the parent of pointing at it.
    if (change.name !== undefined && row.name && change.name !== row.name) {
      for (const r of rows) {
        if (
          r.key !== key &&
          r.side === row.side &&
          r.template === row.template &&
          r.parentTask === row.name
        ) {
          changed.push({ ...r, parentTask: change.name });
        }
      }
    }
    setRows((all) => all.map((r) => changed.find((c) => c.key === r.key) ?? r));
    for (const next of changed) schedule(next);
  }

  // Saves a task shortly after its last change.
  function schedule(next: Row) {
    if (!next.id) return;
    const old = timers.current.get(next.key);
    if (old) window.clearTimeout(old);
    setStatus("saving");
    timers.current.set(
      next.key,
      window.setTimeout(async () => {
        timers.current.delete(next.key);
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
      recurDays: null,
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
      setRows((all) => [
        ...all,
        ...result.tasks!.map((t) => ({ ...t, key: t.id! })),
      ]);
    }
  }

  async function createSide() {
    if (!newSide) return;
    const { label, prefix } = newSide;
    if (!label.trim() || !prefix.trim()) return;
    setBusy(true);
    const result = await addSide(accountId, label, prefix);
    setBusy(false);
    report(result.ok, result.error);
    if (result.ok && result.side) {
      setAdded((all) => [...all, result.side!]);
      setSide(result.side.value);
      setNewSide(null);
    }
  }

  async function deleteSide(info: SideInfo) {
    const n = rows.filter((r) => r.side === info.value).length;
    const ask = n
      ? `Remove ${info.label} and its ${n} task${n === 1 ? "" : "s"}?`
      : `Remove ${info.label}?`;
    if (!window.confirm(ask)) return;
    setStatus("saving");
    const result = await removeSide(accountId, info.value);
    report(result.ok, result.error);
    if (result.ok) {
      setAdded((all) => all.filter((s) => s.value !== info.value));
      setRows((all) => all.filter((r) => r.side !== info.value));
      setSide("buyer");
    }
  }

  async function rename(from: string, to: string) {
    const name = to.trim();
    if (!name || name === from) return;
    setRows((all) =>
      all.map((r) =>
        r.side === side && r.template === from ? { ...r, template: name } : r,
      ),
    );
    const result = await renameTemplate(accountId, side, from, name);
    report(result.ok, result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {sides.map((s) => {
              return (
                <button
                  key={s.value}
                  type="button"
                  role="tab"
                  aria-selected={side === s.value}
                  onClick={() => setSide(s.value)}
                  title={`${s.prefix} templates`}
                  className={`rounded-lg border px-4 py-1.5 text-sm font-semibold ${
                    side === s.value
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-surface text-ink-soft hover:border-accent"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {newSide ? (
            <form
              className="flex flex-wrap items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void createSide();
              }}
            >
              <input
                autoFocus
                value={newSide.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setNewSide({
                    ...newSide,
                    label,
                    // The prefix follows the name's first letter until it's edited.
                    prefix: newSide.edited
                      ? newSide.prefix
                      : label.trim().charAt(0).toUpperCase(),
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setNewSide(null);
                }}
                maxLength={40}
                placeholder="Name, e.g. Dual"
                aria-label="New task list name"
                className="w-36 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
              />
              <label className="flex items-center gap-1 text-xs text-ink-soft">
                Prefix
                <input
                  value={newSide.prefix}
                  onChange={(e) =>
                    setNewSide({
                      ...newSide,
                      prefix: e.target.value,
                      edited: true,
                    })
                  }
                  maxLength={6}
                  placeholder="D"
                  aria-label="Template prefix"
                  className="w-12 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={
                  busy || !newSide.label.trim() || !newSide.prefix.trim()
                }
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setNewSide(null)}
                className="px-1 text-xs font-semibold text-ink-soft"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() =>
                setNewSide({ label: "", prefix: "", edited: false })
              }
              aria-label="Add a task list"
              title="Add a task list"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-border text-lg leading-none text-ink-soft hover:border-accent hover:text-accent"
            >
              +
            </button>
          )}
        </div>
        <span className="text-xs text-ink-faint">
          {sideRows.length} task{sideRows.length === 1 ? "" : "s"} in{" "}
          {templates.length} template
          {templates.length === 1 ? "" : "s"}
          {incomplete > 0 && (
            <span className="font-semibold text-danger">
              {" "}
              &middot; {incomplete} to finish
            </span>
          )}
          {status === "saving" && " · Saving…"}
          {status === "saved" && " · Saved"}
          {status === "error" && (
            <span className="text-danger"> · {error}</span>
          )}
        </span>
      </div>

      {offList > 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-warning">
          {offList} {sideInfo.label.toLowerCase()} task
          {offList === 1 ? " uses a date" : "s use dates"} that isn&rsquo;t an
          Open to Close date field (marked in yellow). Pick one from the list,
          or add the date in{" "}
          <Link
            href="/configurator/select_your_date_fields"
            className="font-semibold underline"
          >
            Select Your Date Fields
          </Link>
          .
        </p>
      )}

      {sideInfo.custom && (
        <div className="-mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => deleteSide(sideInfo)}
            className="text-xs font-semibold text-ink-soft hover:text-danger"
          >
            Remove {sideInfo.label}
          </button>
        </div>
      )}

      {sideRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-ink-soft">
            No {sideInfo.label.toLowerCase()} tasks yet. Start from our{" "}
            {SAMPLE_TASKS.length} sample tasks (in General, Loan, Inspection,
            Termite and Home Warranty templates) and make them yours, or start
            from scratch.
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
              <section
                key={template}
                className="rounded-xl border border-border bg-surface"
              >
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
                      <col className="w-[5.5rem]" />
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
                        <th
                          className="px-1 py-2 text-center font-semibold"
                          title="Critical"
                        >
                          Crit.
                        </th>
                        <th
                          className="px-1 py-2 font-semibold"
                          title="Repeats every so many days"
                        >
                          Recur (days)
                        </th>
                        <th className="px-1 py-2 font-semibold">Days*</th>
                        <th className="px-1 py-2 font-semibold">Time Frame</th>
                        <th className="px-1 py-2 font-semibold">When*</th>
                        <th
                          className="px-1 py-2 font-semibold"
                          title="Due from a date field, or when its parent task is completed: one or the other"
                        >
                          Date Field*
                        </th>
                        <th
                          className="px-1 py-2 font-semibold"
                          title="Due from a date field, or when its parent task is completed: one or the other"
                        >
                          <span className="font-normal text-ink-faint">
                            or{" "}
                          </span>
                          Parent Task*
                        </th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((r) => {
                        const missing = missingFor(r);
                        const bad = (field: string) =>
                          missing.includes(field)
                            ? "border-danger/60"
                            : "border-border";
                        const sameDay = r.timing === "same_day";
                        const notesOpen = openNotes.has(r.key);
                        return (
                          <Fragment key={r.key}>
                            <tr className="align-top">
                              <td className="px-2 py-1.5">
                                <input
                                  value={r.name}
                                  onChange={(e) =>
                                    update(r.key, { name: e.target.value })
                                  }
                                  aria-label="Task name"
                                  title={r.name}
                                  className={`${cellInput} ${bad("a name")}`}
                                />
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={r.critical}
                                  onChange={(e) =>
                                    update(r.key, {
                                      critical: e.target.checked,
                                    })
                                  }
                                  aria-label="Critical"
                                  className="mt-1.5"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={365}
                                  value={r.recurDays ?? ""}
                                  onChange={(e) =>
                                    update(r.key, {
                                      recurDays:
                                        e.target.value === ""
                                          ? null
                                          : Math.min(
                                              365,
                                              Math.max(
                                                1,
                                                Math.trunc(
                                                  Number(e.target.value),
                                                ),
                                              ),
                                            ),
                                    })
                                  }
                                  placeholder="—"
                                  aria-label="Recurs every how many days"
                                  title="Repeats every so many days; leave empty if it doesn't recur"
                                  className={`${cellInput} border-border`}
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
                                          : Math.max(
                                              0,
                                              Math.trunc(
                                                Number(e.target.value),
                                              ),
                                            ),
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
                                      timeFrame: (e.target.value ||
                                        null) as PlannedTask["timeFrame"],
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
                                      timing: (e.target.value ||
                                        null) as PlannedTask["timing"],
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
                                {/* Every date field; one that isn't (from the
                                    samples) still shows, flagged. */}
                                <select
                                  value={r.dateField}
                                  disabled={Boolean(r.parentTask)}
                                  onChange={(e) =>
                                    update(r.key, { dateField: e.target.value })
                                  }
                                  aria-label="Date field"
                                  title={
                                    r.dateField &&
                                    !dateOptions.includes(r.dateField)
                                      ? `${r.dateField} isn't an Open to Close date field`
                                      : r.dateField
                                  }
                                  className={`${cellInput} disabled:opacity-40 ${
                                    r.dateField &&
                                    !dateOptions.includes(r.dateField)
                                      ? "border-warning bg-warning-soft"
                                      : bad("a date field or parent task")
                                  }`}
                                >
                                  <option value="">
                                    {r.parentTask
                                      ? "From parent task"
                                      : "Choose a date…"}
                                  </option>
                                  {r.dateField &&
                                    !dateOptions.includes(r.dateField) && (
                                      <option value={r.dateField}>
                                        {r.dateField} (not a date field)
                                      </option>
                                    )}
                                  {dateGroups.map((g) => (
                                    <optgroup key={g.section} label={g.section}>
                                      {g.names.map((d) => (
                                        <option key={d} value={d}>
                                          {d}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </td>
                              <td className="px-1 py-1.5">
                                {/* The other tasks in this template; due when the
                                    chosen one is completed, instead of from a date. */}
                                <select
                                  value={r.parentTask}
                                  disabled={Boolean(r.dateField.trim())}
                                  onChange={(e) =>
                                    update(r.key, {
                                      parentTask: e.target.value,
                                      dateField: "",
                                    })
                                  }
                                  aria-label="Parent task"
                                  title={r.parentTask}
                                  className={`${cellInput} disabled:opacity-40 ${bad("a date field or parent task")}`}
                                >
                                  <option value="">
                                    {r.dateField.trim()
                                      ? "From date field"
                                      : "None"}
                                  </option>
                                  {[
                                    ...new Set([
                                      ...items
                                        .filter((o) => o.key !== r.key)
                                        .map((o) => o.name),
                                      ...(r.parentTask ? [r.parentTask] : []),
                                    ]),
                                  ]
                                    .filter(Boolean)
                                    .map((n) => (
                                      <option key={n} value={n}>
                                        {n}
                                      </option>
                                    ))}
                                </select>
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
                                    onChange={(e) =>
                                      update(r.key, { notes: e.target.value })
                                    }
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
            <span className="text-sm font-semibold text-ink-soft">
              {sideInfo.prefix}
            </span>
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
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  );
}
