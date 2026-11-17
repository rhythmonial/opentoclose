"use client";

import { useState } from "react";
import Papa from "papaparse";
import { TASK_COMPLETED, TASK_TIME_FRAMES, TIMINGS, type PlannedTask } from "@/lib/taskPlans";
import { DownloadCsvButton } from "@/components/CopyButton";

type SetupTask = PlannedTask & { templateName: string; sideLabel: string };

const labelOf = (list: readonly { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? "";

// Task Template Setup's import columns (the task setup prep sheet's).
const TASK_COLUMNS = [
  "Task Template Name",
  "Task Name",
  "Critical",
  "Recurring Every (Days)",
  "Notes",
  "Days",
  "Time Frame",
  "Before / After / Same Day As",
  "Date Field",
  "Parent Task",
];

const taskLine = (t: SetupTask) => [
  t.templateName,
  t.name,
  t.critical ? "Yes" : "",
  t.recurDays ? String(t.recurDays) : "",
  t.notes,
  t.timing === "same_day" || t.dueDays === null ? "" : String(t.dueDays),
  labelOf(TASK_TIME_FRAMES, t.timeFrame),
  labelOf(TIMINGS, t.timing),
  t.parentTask ? TASK_COMPLETED : t.dateField,
  t.parentTask,
];

// Task Template Setup: every task, grouped by its template, with the CSV.
export function TaskTemplateSetup({ tasks }: { tasks: SetupTask[] }) {
  if (tasks.length === 0) return <Empty />;
  const templates = [...new Set(tasks.map((t) => t.templateName))];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-soft">
          {tasks.length} task{tasks.length === 1 ? "" : "s"} in {templates.length} template
          {templates.length === 1 ? "" : "s"}
        </span>
        <DownloadCsvButton
          csv={Papa.unparse([TASK_COLUMNS, ...tasks.map(taskLine)])}
          fileName="Task Templates - OTC import.csv"
          label="Download CSV for Open to Close"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2.5">Task name</th>
              <th className="px-3 py-2.5">Due</th>
              <th className="px-3 py-2.5">Critical</th>
              <th className="px-3 py-2.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {templates.flatMap((name) => {
              const list = tasks.filter((t) => t.templateName === name);
              return [
                <tr key={`h-${name}`} className="border-b border-border-soft bg-accent-soft/40">
                  <td colSpan={4} className="px-3 py-1.5 font-caption text-xs font-bold uppercase tracking-wide text-accent">
                    {name} ({list.length})
                  </td>
                </tr>,
                ...list.map((t) => (
                  <tr key={t.id ?? `${name}-${t.name}`} className="border-b border-border-soft align-top last:border-0">
                    <td className="px-3 py-2 font-medium text-ink">{t.name}</td>
                    <td className="px-3 py-2 text-xs text-ink-soft">
                      {t.timing === "same_day"
                        ? "Same day as "
                        : t.timing
                          ? `${t.dueDays ?? "?"} ${labelOf(TASK_TIME_FRAMES, t.timeFrame) || "day(s)"} ${t.timing} `
                          : ""}
                      {t.parentTask ? `"${t.parentTask}" is done` : t.dateField}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{t.critical ? "Yes" : ""}</td>
                    <td className="max-w-[18rem] truncate px-3 py-2 text-xs text-ink-soft" title={t.notes}>
                      {t.notes}
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TRIGGER_COLUMNS = [
  "Task Template Name",
  "Trigger Function",
  "Task Name",
  "Trigger Action",
  "Email Template Name",
  "File Roles",
  "Use Default Email | Text Number",
];

type Trigger = {
  key: string;
  template: string;
  task: string;
  email: string;
  files: string;
  fn: "send_email" | "send_text";
  action: "task_completed" | "task_not_completed";
  useDefault: boolean;
};

// Task Trigger Setup: one trigger per email a task sends, with its file
// roles. Function, action and "use default number" start as send_email,
// task_completed and Yes, and can be changed before downloading.
export function TaskTriggerSetup({ tasks }: { tasks: SetupTask[] }) {
  const [rows, setRows] = useState<Trigger[]>(() =>
    tasks.flatMap((t) =>
      t.emails.map((email, i) => ({
        key: `${t.id}-${i}`,
        template: t.templateName,
        task: t.name,
        email,
        files: t.documents.join(", "),
        fn: "send_email" as const,
        action: "task_completed" as const,
        useDefault: true,
      })),
    ),
  );
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
        No triggers yet. Link email templates to your tasks in Prep Your Tasks.
      </p>
    );
  }
  const set = (key: string, change: Partial<Trigger>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const select = "rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-soft">
          {rows.length} trigger{rows.length === 1 ? "" : "s"}
        </span>
        <DownloadCsvButton
          csv={Papa.unparse([
            TRIGGER_COLUMNS,
            ...rows.map((r) => [r.template, r.fn, r.task, r.action, r.email, r.files, r.useDefault ? "Yes" : ""]),
          ])}
          fileName="Task Triggers - OTC import.csv"
          label="Download CSV for Open to Close"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-bg font-caption text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {TRIGGER_COLUMNS.map((c) => (
                <th key={c} className="px-3 py-2.5">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border-soft align-top last:border-0">
                <td className="px-3 py-2 text-ink">{r.template}</td>
                <td className="px-3 py-2">
                  <select value={r.fn} onChange={(e) => set(r.key, { fn: e.target.value as Trigger["fn"] })} className={select}>
                    <option value="send_email">send_email</option>
                    <option value="send_text">send_text</option>
                  </select>
                </td>
                <td className="px-3 py-2 font-medium text-ink">{r.task}</td>
                <td className="px-3 py-2">
                  <select
                    value={r.action}
                    onChange={(e) => set(r.key, { action: e.target.value as Trigger["action"] })}
                    className={select}
                  >
                    <option value="task_completed">task_completed</option>
                    <option value="task_not_completed">task_not_completed</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-ink-soft">{r.email}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">{r.files}</td>
                <td className="px-3 py-2">
                  <label className="flex items-center gap-1.5 text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={r.useDefault}
                      onChange={(e) => set(r.key, { useDefault: e.target.checked })}
                    />
                    {r.useDefault ? "Yes" : "(blank)"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <p className="rounded-xl border border-border bg-surface p-6 text-sm text-ink-soft">
      No tasks yet. Add them in Prep Your Tasks.
    </p>
  );
}
