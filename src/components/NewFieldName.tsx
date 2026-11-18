"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/CopyButton";
import { setFieldBuilt } from "@/app/configurator/field_setup/actions";
import { optionKey } from "@/lib/fieldSetup";

// A field's name in Field Setup. A field they're creating starts with an
// empty checkbox; copying its name (or clicking the box) checks it off as
// created, and clicking a checked box unchecks it.
export function NewFieldName({
  accountId,
  fieldId,
  name,
  isNew,
  copyable,
  initialBuilt,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  fieldId: string;
  name: string;
  isNew: boolean;
  copyable: boolean;
  initialBuilt: boolean;
}) {
  const [built, setBuilt] = useState(initialBuilt);
  const mark = (next: boolean) => {
    setBuilt(next);
    void setFieldBuilt(accountId, fieldId, next);
  };
  return (
    <span className="inline-flex items-center gap-1">
      {isNew && <BuiltCheckbox built={built} label={name} onToggle={() => mark(!built)} />}
      <span className="font-semibold text-ink">{name}</span>
      {copyable && (
        <span onClickCapture={() => isNew && !built && mark(true)}>
          <CopyIcon text={name} />
        </span>
      )}
    </span>
  );
}

// An empty box, or a green check once it's done.
export function BuiltCheckbox({
  built,
  label,
  onToggle,
}: {
  built: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={built ? "Done in Open to Close (click to undo)" : "Not done in Open to Close yet"}
      aria-label={built ? `${label}: done` : `${label}: not done yet`}
      aria-pressed={built}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
        built ? "border-success bg-success text-white" : "border-ink-faint bg-surface"
      }`}
    >
      {built && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}

// A new choice option in Field Setup: copying it checks it off (a check to
// its left); clicking the check unchecks it.
export function NewChoiceOption({
  accountId,
  fieldId,
  title,
  initialBuilt,
}: {
  accountId: string | null;
  fieldId: string;
  title: string;
  initialBuilt: boolean;
}) {
  const [built, setBuilt] = useState(initialBuilt);
  const mark = (next: boolean) => {
    setBuilt(next);
    void setFieldBuilt(accountId, optionKey(fieldId, title), next);
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/10 py-0.5 pl-1.5 pr-1 text-xs text-ink">
      {built && (
        <button
          type="button"
          onClick={() => mark(false)}
          title="Added in Open to Close (click to undo)"
          aria-label={`${title}: added (undo)`}
          className="text-success"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
      )}
      {title}
      <span onClickCapture={() => !built && mark(true)}>
        <CopyIcon text={title} />
      </span>
    </span>
  );
}
