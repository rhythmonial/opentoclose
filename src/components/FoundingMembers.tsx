"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "@/app/founding/questions";
import { setFoundingStatus } from "@/app/dashboard/actions";

export type FoundingApp = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  business_name: string;
  company_structure: string;
  states_serviced: string | null;
  priority_state: string | null;
  tms: string | null;
  status: string;
  answers: Record<string, string>;
};

const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "link_sent", label: "Link Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

// Staff: the founding group applications still in play, one row each.
// Clicking a row opens their answers. Won takes them off the list (they're
// a client once they sign up); Lost files them under the archived leads.
export function FoundingMembers({ apps: initial }: { apps: FoundingApp[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [open, setOpen] = useState<FoundingApp | null>(null);

  async function changeStatus(app: FoundingApp, status: string) {
    setApps((all) =>
      status === "won" || status === "lost"
        ? all.filter((a) => a.id !== app.id)
        : all.map((a) => (a.id === app.id ? { ...a, status } : a)),
    );
    const res = await setFoundingStatus(app.id, status);
    if (!res.ok) window.alert(res.error ?? "Couldn't save.");
    router.refresh();
  }

  return (
    <>
      <div className="mt-4 min-w-0 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">State &amp; structure</th>
              <th className="px-5 py-3">Closings &amp; team</th>
              <th className="px-5 py-3">Setup &amp; launch</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-ink-faint">
                  No applications waiting.
                </td>
              </tr>
            )}
            {apps.map((a) => (
              <tr
                key={a.id}
                onClick={() => setOpen(a)}
                className="cursor-pointer border-b border-border-soft align-top last:border-0 hover:bg-bg"
              >
                <td className="px-5 py-3.5">
                  <button type="button" className="text-left font-semibold text-ink hover:text-accent">
                    {a.first_name} {a.last_name}
                  </button>
                  <div className="text-xs text-ink-faint">{a.business_name}</div>
                </td>
                <td className="px-5 py-3.5 text-ink-soft">
                  <div>{a.states_serviced ?? "—"}</div>
                  <div className="text-xs text-ink-faint">{a.company_structure}</div>
                </td>
                <td className="px-5 py-3.5 text-ink-soft">
                  <div>{a.answers.volume ? `${a.answers.volume} closings` : "—"}</div>
                  <div className="text-xs text-ink-faint">
                    {a.answers.users ? `${a.answers.users} on the team` : ""}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-ink-soft">
                  <div>{a.answers.done_with_you ? `Done-with-you: ${a.answers.done_with_you}` : "—"}</div>
                  <div className="text-xs text-ink-faint">
                    {a.answers.launch_timeline ? `Launch: ${a.answers.launch_timeline}` : ""}
                  </div>
                </td>
                <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={a.status}
                    onChange={(e) => changeStatus(a, e.target.value)}
                    aria-label={`Status for ${a.first_name} ${a.last_name}`}
                    className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-ink"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="founding-app-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(null);
          }}
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="founding-app-title" className="font-display text-lg font-bold text-ink">
                  {open.first_name} {open.last_name}
                </h2>
                <p className="text-sm text-ink-soft">
                  {open.business_name} &middot; {open.company_structure}
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="rounded-md px-2 text-xl leading-none text-ink-faint hover:text-ink"
              >
                &times;
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {[
                ["Email", open.email],
                ["Cell phone", open.phone ?? "—"],
                [
                  "States serviced",
                  `${open.states_serviced ?? "—"}${open.priority_state ? ` (priority: ${open.priority_state})` : ""}`,
                ],
                ["Current transaction management software", open.tms ?? "—"],
                ...QUESTIONS.map((q) => [q.label, open.answers[q.key] ?? "—"]),
                [
                  "Applied",
                  new Date(open.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-ink-faint">{label}</dt>
                  <dd className="whitespace-pre-wrap text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
