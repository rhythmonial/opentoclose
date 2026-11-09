"use client";

import { useState, useTransition } from "react";
import type { OtcField } from "@/lib/otcFields";
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
// every contract), or leave it as a new field.
export function NewFieldMapper({
  accountId,
  createdId,
  createdName,
  choices,
  onMapped,
}: {
  accountId: string | null;
  createdId: string;
  createdName: string;
  choices: OtcField[];
  onMapped?: FieldsChange;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="flex flex-col">
      <select
        value=""
        disabled={pending}
        title="Keep as a new field, or pick the Open to Close field it is"
        aria-label={`Open to Close field for ${createdName}`}
        onChange={(e) => {
          const to = choices.find((f) => f.id === e.target.value);
          if (!to) return;
          start(async () => {
            const res = await mapCreatedField(accountId, createdId, to.id);
            if (!res.ok) {
              setError(res.error ?? "Couldn't save.");
              return;
            }
            if (onMapped) onMapped((fields) => mapCreated(fields, createdId, to));
            else window.location.reload();
          });
        }}
        className={`${BOX} border-border px-1.5`}
      >
        <option value="">{pending ? "Saving…" : "Keep as a new field"}</option>
        {choices.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      {error && <span className="mt-0.5 text-xs text-danger">{error}</span>}
    </span>
  );
}
