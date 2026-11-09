"use client";

import { useState, useTransition } from "react";
import type { OtcField } from "@/lib/otcFields";
import {
  mapCreatedField,
  saveFieldName,
} from "@/app/configurator/assign_your_workflow_fields/actions";

// What the client would like an OTC field called, saved when they leave the
// box. Blank goes back to Open to Close's name.
export function FieldRenameInput({
  accountId,
  otcId,
  otcName,
  initial,
}: {
  accountId: string | null;
  otcId: string;
  otcName: string;
  initial: string;
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

  return (
    <span className="flex flex-col">
      <input
        type="text"
        value={value}
        maxLength={120}
        placeholder={otcName}
        aria-label={`Rename ${otcName}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setValue(saved);
        }}
        className={`w-full min-w-[9rem] rounded-md border bg-surface px-2 py-1 text-sm text-ink placeholder:text-ink-faint ${
          error ? "border-danger" : "border-border"
        } ${pending ? "opacity-60" : ""}`}
      />
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
}: {
  accountId: string | null;
  createdId: string;
  createdName: string;
  choices: OtcField[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="flex flex-col">
      <select
        value=""
        disabled={pending}
        aria-label={`Open to Close field for ${createdName}`}
        onChange={(e) => {
          const otcId = e.target.value;
          if (!otcId) return;
          start(async () => {
            const res = await mapCreatedField(accountId, createdId, otcId);
            // The contracts above hold their own copy of the fields, so
            // reload to pick up the change everywhere.
            if (res.ok) window.location.reload();
            else setError(res.error ?? "Couldn't save.");
          });
        }}
        className="w-full min-w-[9rem] rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink disabled:opacity-60"
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
