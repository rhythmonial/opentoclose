"use client";

import { useEffect, useRef, useState } from "react";
import type { ContractBlank } from "@/lib/contractBlanks";
import { PdfPageCanvas, usePdfDocument } from "@/components/PdfPageCanvas";
import {
  FIELD_TYPES,
  fieldTag,
  isComplete,
  type WorkflowField,
  type WorkflowFieldType,
} from "@/lib/workflowFields";

type Field = ContractBlank & { id: string };

// A checkbox is named by its option (after it); a blank by the text before it.
function fieldLabel(b: ContractBlank) {
  return (
    (b.type === "checkbox" ? b.after || b.label : b.label || b.after) || "Unlabeled field"
  );
}

// Shows a contract page by page with every field from the review outlined.
// Clicking a field asks what kind of workflow field it is (and, for decimals
// and choices, a follow-up question); choosing a type adds it to the
// workflow. Changes go to `onSave` shortly after each one; without it, they
// stay on this screen.
export function WorkflowFieldPicker({
  source,
  pageCount,
  blanks,
  initialFields,
  onSave,
}: {
  source: ArrayBuffer | string;
  pageCount: number;
  blanks: ContractBlank[];
  initialFields: WorkflowField[];
  onSave?: (fields: WorkflowField[]) => Promise<{ ok: boolean }>;
}) {
  const { doc, error } = usePdfDocument(source);
  const [page, setPage] = useState(1);
  const [picks, setPicks] = useState(
    () => new Map(initialFields.map((f) => [f.id, f] as const)),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const timer = useRef<number | null>(null);

  const fields = blanks.filter((b): b is Field => Boolean(b.id));
  const onPage = fields.filter((b) => b.page === page);
  const pickedOn = (n: number) => fields.filter((b) => b.page === n && picks.has(b.id));
  const incomplete = [...picks.values()].filter((f) => !isComplete(f)).length;
  const open = onPage.find((b) => b.id === openId) ?? null;

  function update(next: Map<string, WorkflowField>) {
    setPicks(next);
    if (!onSave) return;
    if (timer.current) window.clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = window.setTimeout(async () => {
      const result = await onSave([...next.values()]);
      setSaveState(result.ok ? "saved" : "error");
    }, 600);
  }

  function setField(id: string, field: WorkflowField | null) {
    const next = new Map(picks);
    if (field) next.set(id, field);
    else next.delete(id);
    update(next);
  }

  function changePage(n: number) {
    setOpenId(null);
    setPage(n);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
            const picked = pickedOn(n);
            const needsAnswer = picked.some((b) => !isComplete(picks.get(b.id)!));
            return (
              <button
                key={n}
                type="button"
                onClick={() => changePage(n)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                  n === page
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-ink-soft"
                }`}
              >
                Page {n}
                {picked.length > 0 && (
                  <span
                    className={
                      needsAnswer
                        ? n === page
                          ? "text-white"
                          : "text-danger"
                        : n === page
                          ? "text-white/80"
                          : "text-accent"
                    }
                  >
                    {" "}
                    &middot; {picked.length}
                    {needsAnswer && "!"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-ink-faint">
          {picks.size} workflow field{picks.size === 1 ? "" : "s"} picked
          {incomplete > 0 && (
            <span className="font-semibold text-danger">
              {" "}
              &middot; {incomplete} need{incomplete === 1 ? "s" : ""} an answer
            </span>
          )}
          {saveState === "saving" && " · Saving…"}
          {saveState === "saved" && " · Saved"}
          {saveState === "error" && <span className="text-danger"> · Couldn&rsquo;t save</span>}
        </span>
      </div>

      <p className="text-sm text-ink-soft">
        Click each field your team needs to track during a transaction and
        choose what kind of field it is. Click a picked field to change it or
        take it back out.
      </p>

      <div className="relative overflow-hidden rounded-lg border border-border bg-white">
        {error ? (
          <p className="p-6 text-sm text-danger">{error}</p>
        ) : !doc ? (
          <p className="p-6 text-sm text-ink-faint">Loading page&hellip;</p>
        ) : (
          <>
            <PdfPageCanvas doc={doc} page={page} />
            <div className="absolute inset-0">
              {onPage.map((b) => {
                const pick = picks.get(b.id);
                const done = pick ? isComplete(pick) : false;
                const label = fieldLabel(b);
                return (
                  <button
                    key={b.id}
                    type="button"
                    data-workflow-field
                    onClick={() => setOpenId(openId === b.id ? null : b.id)}
                    aria-pressed={Boolean(pick)}
                    aria-expanded={openId === b.id}
                    aria-label={`${label}${pick ? `: ${fieldTag(pick)}` : ""}`}
                    title={label}
                    className={`absolute rounded-sm border-2 transition-colors ${
                      !pick
                        ? "border-gold/70 bg-gold/10 hover:bg-gold/30"
                        : done
                          ? "border-accent bg-accent/30"
                          : "border-danger bg-danger/15"
                    } ${openId === b.id ? "ring-2 ring-accent ring-offset-1" : ""}`}
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.width * 100}%`,
                      height: `${b.height * 100}%`,
                    }}
                  >
                    {pick && (
                      <span
                        className={`pointer-events-none absolute -top-3.5 left-0 whitespace-nowrap rounded px-1 py-px text-[9px] font-bold leading-tight text-white ${
                          done ? "bg-accent" : "bg-danger"
                        }`}
                      >
                        {fieldTag(pick)}
                        {!done && " ?"}
                      </span>
                    )}
                  </button>
                );
              })}

              {open && (
                <FieldTypePopover
                  key={open.id}
                  blank={open}
                  label={fieldLabel(open)}
                  value={picks.get(open.id) ?? null}
                  onChange={(f) => setField(open.id, f)}
                  onClose={() => setOpenId(null)}
                />
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-gold/70 bg-gold/10" />
          Contract field
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-accent bg-accent/30" />
          Workflow field
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-danger bg-danger/15" />
          Needs an answer
        </span>
      </div>
    </div>
  );
}

const DECIMAL_FORMATS = [
  { value: "currency", label: "Currency ($)" },
  { value: "percentage", label: "Percentage (%)" },
] as const;

const CHOICE_ROLES = [
  { value: "question", label: "Choice question" },
  { value: "option", label: "Choice option" },
] as const;

// The menu that opens under a clicked field: its type, then the follow-up
// question decimals and choices need.
function FieldTypePopover({
  blank,
  label,
  value,
  onChange,
  onClose,
}: {
  blank: Field;
  label: string;
  value: WorkflowField | null;
  onChange: (field: WorkflowField | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  // Kept current so the listeners below are set up once, when it opens.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    selectRef.current?.focus();
    const onClose = () => closeRef.current();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      // Clicking another field switches to it (its own click handles that).
      if (ref.current?.contains(target) || target.closest("[data-workflow-field]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Open below the field, or above it near the bottom of the page, and keep
  // it on the page sideways.
  const below = blank.y + blank.height < 0.72;
  const fromRight = blank.x > 0.55;
  const style: React.CSSProperties = {
    ...(below
      ? { top: `calc(${(blank.y + blank.height) * 100}% + 6px)` }
      : { bottom: `calc(${(1 - blank.y) * 100}% + 6px)` }),
    ...(fromRight
      ? { right: `${Math.max(0, 1 - blank.x - blank.width) * 100}%` }
      : { left: `${blank.x * 100}%` }),
  };

  const type = value?.type;

  function pickType(next: WorkflowFieldType | "") {
    if (!next) return onChange(null);
    // Follow-up answers only carry over when the type stays the same.
    onChange(next === type ? value : { id: blank.id, type: next });
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Workflow field: ${label}`}
      style={style}
      className="absolute z-20 flex w-64 flex-col gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-lg"
    >
      <p className="truncate text-xs font-semibold text-ink" title={label}>
        {label}
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft">Field type</span>
        <select
          ref={selectRef}
          value={type ?? ""}
          onChange={(e) => pickType(e.target.value as WorkflowFieldType | "")}
          className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        >
          <option value="">Choose a type&hellip;</option>
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {type === "decimal" && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium text-ink-soft">
            Is it a currency or a percentage?
          </legend>
          {DECIMAL_FORMATS.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={`decimal-${blank.id}`}
                checked={value?.decimal_format === o.value}
                onChange={() => onChange({ id: blank.id, type, decimal_format: o.value })}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}

      {type === "choice" && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium text-ink-soft">
            Is this the choice question or one of its options?
          </legend>
          {CHOICE_ROLES.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={`choice-${blank.id}`}
                checked={value?.choice_role === o.value}
                onChange={() => onChange({ id: blank.id, type, choice_role: o.value })}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onClose();
            }}
            className="text-xs font-semibold text-danger"
          >
            Remove from workflow
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
