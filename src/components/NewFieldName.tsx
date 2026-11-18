"use client";

import { useState } from "react";
import { CopyIcon } from "@/components/CopyButton";
import { setFieldBuilt } from "@/app/configurator/field_setup/actions";

// A field's name in Field Setup. A field they're creating starts with a red
// "+"; copying its name (or clicking the "+") turns it green, created, and
// clicking the green one turns it back.
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
      {isNew && (
        <button
          type="button"
          onClick={() => mark(!built)}
          title={built ? "Created in Open to Close (click to undo)" : "To create in Open to Close"}
          aria-label={built ? `${name}: created` : `${name}: to create`}
          aria-pressed={built}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
            built ? "bg-success" : "bg-danger"
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
      <span className="font-semibold text-ink">{name}</span>
      {copyable && (
        <span onClickCapture={() => isNew && !built && mark(true)}>
          <CopyIcon text={name} />
        </span>
      )}
    </span>
  );
}
