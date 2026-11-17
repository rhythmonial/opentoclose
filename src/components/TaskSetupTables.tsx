"use client";

import { useState } from "react";
import Papa from "papaparse";
import { TASK_COMPLETED, TIMINGS, type PlannedTask } from "@/lib/taskPlans";
import { DownloadCsvButton } from "@/components/CopyButton";

type SetupTask = PlannedTask & { templateName: string; sideLabel: string };

const labelOf = (list: readonly { value: string; label: string }[], v: string | null) =>
  list.find((x) => x.value === v)?.label ?? "";

// Open to Close's task import columns (one file per task template).
const TASK_COLUMNS = [
  "Task Name ( title )",
  "Exclude ( private )",
  "Critical",
  "Recurring Days",
  "Scheduled Due Days",
  "Scheduled Due Time Frame",
  "Scheduled Due Type",
  "Due Date ( field )",
];

const TIME_FRAME_NAMES: Record<string, string> = {
  business_days: "Business",
  calendar_days: "Calendar",
  calendar_days_skip_weekend: "Calendar Skip Weekend",
};

const taskLine = (t: SetupTask, exclude: boolean) => {
  const sameDay = t.timing === "same_day";
  return [
    t.name,
    exclude ? "Yes" : "",
    t.critical ? "Yes" : "",
    t.recurDays ? String(t.recurDays) : "",
    sameDay || t.dueDays === null ? "" : String(t.dueDays),
    sameDay ? "Same Day As" : (TIME_FRAME_NAMES[t.timeFrame ?? ""] ?? ""),
    sameDay ? "" : labelOf(TIMINGS, t.timing),
    t.parentTask ? TASK_COMPLETED : t.dateField,
  ];
};

const fileNameFor = (template: string) =>
  `${template.replace(/[\\/:*?"<>|]+/g, "-")} - OTC task import.csv`;

// Task Template Setup: every task, grouped by its template, each template
// with its own CSV in Open to Close's task import columns. "Exclude
// (private)" starts as Yes and can be cleared per task.
export function TaskTemplateSetup({ tasks }: { tasks: SetupTask[] }) {
  const [shared, setShared] = useState<Set<string>>(new Set());
  if (tasks.length === 0) return <Empty />;
  const templates = [...new Set(tasks.map((t) => t.templateName))];
  const keyOf = (t: SetupTask) => t.id ?? `${t.templateName}-${t.name}`;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-ink-soft">
        {tasks.length} task{tasks.length === 1 ? "" : "s"} in {templates.length} template
        {templates.length === 1 ? "" : "s"}. Download each template&rsquo;s CSV and import it into
        that task template in Open to Close.
      </span>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2.5">Task name</th>
              <th className="px-3 py-2.5">Exclude (private)</th>
              <th className="px-3 py-2.5">Critical</th>
              <th className="px-3 py-2.5">Due</th>
              <th className="px-3 py-2.5">Due date field</th>
            </tr>
          </thead>
          <tbody>
            {templates.flatMap((name) => {
              const list = tasks.filter((t) => t.templateName === name);
              return [
                <tr key={`h-${name}`} className="border-b border-border-soft bg-accent-soft/40">
                  <td colSpan={5} className="px-3 py-1.5">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-caption text-xs font-bold uppercase tracking-wide text-accent">
                        {name} ({list.length})
                      </span>
                      <DownloadCsvButton
                        csv={Papa.unparse([TASK_COLUMNS, ...list.map((t) => taskLine(t, !shared.has(keyOf(t))))])}
                        fileName={fileNameFor(name)}
                        label="Download CSV"
                      />
                    </span>
                  </td>
                </tr>,
                ...list.map((t) => {
                  const k = keyOf(t);
                  const line = taskLine(t, !shared.has(k));
                  return (
                    <tr key={k} className="border-b border-border-soft align-top last:border-0">
                      <td className="px-3 py-2 font-medium text-ink">{t.name}</td>
                      <td className="px-3 py-2">
                        <label className="flex items-center gap-1.5 text-xs text-ink">
                          <input
                            type="checkbox"
                            checked={!shared.has(k)}
                            onChange={(e) =>
                              setShared((all) => {
                                const next = new Set(all);
                                if (e.target.checked) next.delete(k);
                                else next.add(k);
                                return next;
                              })
                            }
                          />
                          {shared.has(k) ? "(blank)" : "Yes"}
                        </label>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-soft">{line[2]}</td>
                      <td className="px-3 py-2 text-xs text-ink-soft">
                        {[line[4], line[5], line[6]].filter(Boolean).join(" ")}
                        {line[3] && <span className="block">Every {line[3]} days</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink">{line[7]}</td>
                    </tr>
                  );
                }),
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
