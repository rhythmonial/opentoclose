"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { OTC_SECTIONS, sectionById, type OtcField } from "@/lib/otcFields";
import { mapCreated, unmapCreated, type WorkflowField } from "@/lib/workflowFields";
import {
  mapCreatedField,
  saveFieldName,
  unmapCreatedField,
} from "@/app/configurator/assign_your_workflow_fields/actions";

type FieldsChange = (change: (fields: WorkflowField[]) => WorkflowField[]) => void;

const BOX =
  "w-[10.5rem] rounded-md border bg-surface py-1 text-sm text-ink disabled:opacity-60";

// What the client would like an OTC field called, saved when they leave the
// box. Blank goes back to Open to Close's name. A field they added and then
// pointed at this OTC field has ↺ inside the box to put it back.
export function FieldRenameInput({
  accountId,
  otcId,
  otcName,
  initial,
  revertTo,
  onReverted,
}: {
  accountId: string | null;
  otcId: string;
  otcName: string;
  initial: string;
  revertTo?: { id: string; name: string };
  onReverted?: FieldsChange;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    const next = value.trim();
    if (next === saved.trim()) return;
    start(async () => {
      const res = await saveFieldName(accountId, otcId, next);
      if (res.ok) {
        setSaved(next);
        setError(null);
      } else setError(res.error ?? "Couldn't save.");
    });
  };

  const revert = () => {
    if (!revertTo) return;
    start(async () => {
      const res = await unmapCreatedField(accountId, revertTo.id);
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        return;
      }
      if (onReverted) onReverted((fields) => unmapCreated(fields, revertTo.id));
      else window.location.reload();
    });
  };

  return (
    <span className="flex flex-col">
      <span className="relative inline-flex w-fit">
        <input
          type="text"
          value={value}
          maxLength={120}
          placeholder={otcName}
          title={value || otcName}
          aria-label={`Rename ${otcName}`}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setValue(saved);
          }}
          className={`${BOX} px-2 placeholder:text-ink-faint ${revertTo ? "pr-7" : ""} ${
            error ? "border-danger" : "border-border"
          }`}
        />
        {revertTo && (
          <button
            type="button"
            onClick={revert}
            disabled={pending}
            aria-label={`Put back as ${revertTo.name}`}
            title={`Put back as ${revertTo.name} (new field)`}
            className="absolute inset-y-0 right-1 my-auto flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-bg hover:text-accent disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </span>
      {error && <span className="mt-0.5 text-xs text-danger">{error}</span>}
    </span>
  );
}

// A field the client added: pick the Open to Close field it really is (on
// every contract), or leave it as a new field. A search box and the fields
// grouped by section, in a list that opens over the page.
export function NewFieldMapper({
  accountId,
  createdId,
  createdName,
  choices,
  onMapped,
  onPicked,
}: {
  accountId: string | null;
  createdId: string;
  createdName: string;
  choices: OtcField[];
  onMapped?: FieldsChange;
  // Told the OTC field it was pointed at (instead of reloading the page).
  onPicked?: (to: OtcField) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [at, setAt] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = () => {
    setAt(null);
    setQuery("");
  };

  // Closes on a click elsewhere, Escape, or scrolling the page.
  useEffect(() => {
    if (!at) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [at]);

  const pick = (to: OtcField) => {
    close();
    start(async () => {
      const res = await mapCreatedField(accountId, createdId, to.id);
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        return;
      }
      if (onMapped) onMapped((fields) => mapCreated(fields, createdId, to));
      if (onPicked) onPicked(to);
      if (!onMapped && !onPicked) window.location.reload();
    });
  };

  const q = query.trim().toLowerCase();
  const sectionName = (f: OtcField) => sectionById(f.sectionId)?.name ?? "Other";
  const order = new Map(OTC_SECTIONS.map((sec, i) => [sec.id, i] as const));
  const groups = new Map<string, OtcField[]>();
  for (const f of [...choices].sort(
    (a, b) => (order.get(a.sectionId) ?? 999) - (order.get(b.sectionId) ?? 999),
  )) {
    if (q && !f.name.toLowerCase().includes(q) && !sectionName(f).toLowerCase().includes(q)) continue;
    groups.set(sectionName(f), [...(groups.get(sectionName(f)) ?? []), f]);
  }

  return (
    <span className="flex flex-col">
      <button
        ref={trigger}
        type="button"
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={Boolean(at)}
        aria-label={`Open to Close field for ${createdName}`}
        title="Keep as a new field, or pick the Open to Close field it is"
        onClick={() => {
          if (at) return close();
          const r = trigger.current!.getBoundingClientRect();
          const up = r.bottom + 320 > window.innerHeight && r.top > 320;
          setAt({ top: up ? r.top - 4 : r.bottom + 4, left: Math.max(8, r.right - 288), up });
        }}
        className={`${BOX} flex items-center justify-between gap-1 border-border px-2 text-left`}
      >
        <span className="truncate">{pending ? "Saving…" : "Keep as a new field"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden className="shrink-0 text-ink-faint">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {at && (
        <div
          ref={panel}
          role="listbox"
          style={{
            position: "fixed",
            left: at.left,
            ...(at.up ? { bottom: window.innerHeight - at.top } : { top: at.top }),
          }}
          className="z-50 flex w-72 flex-col rounded-lg border border-border bg-surface p-1.5 shadow-lg"
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Open to Close fields"
            aria-label="Search Open to Close fields"
            className="mb-1 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="button"
            role="option"
            aria-selected
            onClick={close}
            className="rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/50"
          >
            Keep as a new field
          </button>
          <div className="max-h-64 overflow-y-auto">
            {[...groups].map(([group, items]) => (
              <div key={group} role="group" aria-label={group}>
                <p className="sticky top-0 bg-surface px-2.5 pb-0.5 pt-2 text-xs font-bold text-ink">
                  {group}
                </p>
                {items.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => pick(f)}
                    className="block w-full rounded-md px-2.5 py-1 pl-4 text-left text-sm text-ink hover:bg-accent-soft/50"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            ))}
            {groups.size === 0 && (
              <p className="px-2.5 py-1.5 text-xs text-ink-faint">No Open to Close fields match.</p>
            )}
          </div>
        </div>
      )}
      {error && <span className="mt-0.5 text-xs text-danger">{error}</span>}
    </span>
  );
}
