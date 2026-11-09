"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

export type LessonOption = {
  id: string;
  title: string;
  phase: string;
  section: string;
  // Already complete: shown checked and can't be picked.
  done?: boolean;
};

// A + button on a client's page that opens the Log hours form: date, hours,
// description and the lessons the time was spent on.
export function LogHoursButton({
  accountId,
  clientId,
  lessons,
  action,
}: {
  accountId: string;
  clientId: string;
  lessons: LessonOption[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lessons by pillar, narrowed by the search box.
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const byPhase = new Map<string, LessonOption[]>();
    for (const l of lessons) {
      if (q && !`${l.title} ${l.section} ${l.phase}`.toLowerCase().includes(q)) continue;
      const list = byPhase.get(l.phase) ?? [];
      list.push(l);
      byPhase.set(l.phase, list);
    }
    return Array.from(byPhase);
  }, [lessons, filter]);

  const close = () => {
    setOpen(false);
    setPicked(new Set());
    setFilter("");
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const input =
    "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Log hours"
        title="Log hours"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:opacity-90"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-hours-title"
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface text-left shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <h2 id="log-hours-title" className="text-[15px] font-bold text-ink">
                Log hours
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-bg hover:text-ink"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form
              action={(fd) =>
                startTransition(async () => {
                  await action(fd);
                  close();
                })
              }
              className="flex min-h-0 flex-1 flex-col"
            >
              <input type="hidden" name="account_id" value={accountId} />
              <input type="hidden" name="client_id" value={clientId} />
              {Array.from(picked).map((id) => (
                <input key={id} type="hidden" name="step_ids" value={id} />
              ))}

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-soft">Date</span>
                    <input
                      type="date"
                      name="logged_date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className={input}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-ink-soft">Hours</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      name="hours"
                      required
                      className={input}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">Description</span>
                  <textarea name="description" rows={2} required className={input} />
                </label>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-ink-soft">Lessons worked on</span>
                    {picked.size > 0 && (
                      <span className="text-xs font-semibold text-accent">
                        {picked.size} selected
                      </span>
                    )}
                  </div>
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search lessons"
                    aria-label="Search lessons"
                    className={input}
                  />
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-bg">
                    {groups.length === 0 && (
                      <p className="px-3 py-3 text-sm text-ink-faint">
                        {lessons.length === 0
                          ? "They haven’t requested any set ups yet."
                          : "No lessons match."}
                      </p>
                    )}
                    {groups.map(([phase, list]) => (
                      <div key={phase}>
                        <div className="sticky top-0 bg-border-soft px-3 py-1.5 text-xs font-bold text-ink">
                          {phase}
                        </div>
                        {list.map((l) => (
                          <label
                            key={l.id}
                            title={l.done ? "Complete" : undefined}
                            className={`flex items-start gap-2.5 px-3 py-1.5 text-sm ${
                              l.done
                                ? "cursor-default text-ink-faint"
                                : "cursor-pointer text-ink hover:bg-surface"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={l.done || picked.has(l.id)}
                              disabled={l.done}
                              onChange={() => toggle(l.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-accent disabled:opacity-50"
                            />
                            <span className="min-w-0">
                              {l.title}
                              <span className="ml-1.5 text-xs text-ink-faint">
                                {l.done ? "Complete" : l.section}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Logging…" : "Log hours"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
