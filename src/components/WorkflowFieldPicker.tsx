"use client";

import { useEffect, useRef, useState } from "react";
import type { ContractBlank } from "@/lib/contractBlanks";
import { PdfPageCanvas, usePdfDocument } from "@/components/PdfPageCanvas";
import {
  fieldTag,
  isComplete,
  NEW_QUESTION_PREFIX,
  type WorkflowField,
} from "@/lib/workflowFields";

type Field = ContractBlank & { id: string };

// A checkbox is named by its option (after it); a blank by the text before
// it. A bare number is usually the contract's line number, not a name.
function fieldLabel(b: ContractBlank) {
  const name = (t?: string) => (t && !/^\d+$/.test(t.trim()) ? t : "");
  const label = name(b.label);
  const after = name(b.after);
  return (b.type === "checkbox" ? after || label : label || after) || "Unlabeled field";
}

// Shows a contract page by page with every field from the review outlined.
// Clicking a field drops down a menu of workflow field types; choosing one
// adds it to the workflow. A choice option is tied to a choice question. Changes go to `onSave` shortly after each one; without it, they
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
  const byId = new Map(fields.map((b) => [b.id, b] as const));

  // Choice questions picked so far (fields marked as a question, and ones
  // typed in for an option), most recent first.
  const questions: { id: string; text: string }[] = [];
  const seenQuestions = new Set<string>();
  for (const f of picks.values()) {
    if (f.type !== "choice") continue;
    let q: { id: string; text: string } | null = null;
    if (f.choice_role === "question") {
      const b = byId.get(f.id);
      q = { id: f.id, text: b ? `Page ${b.page}: ${fieldLabel(b)}` : "Choice question" };
    } else if (f.question_id?.startsWith(NEW_QUESTION_PREFIX) && f.question_text) {
      q = { id: f.question_id, text: f.question_text };
    }
    if (q && !seenQuestions.has(q.id)) {
      seenQuestions.add(q.id);
      questions.unshift(q);
    }
  }

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
    // A field that stops being a choice question leaves its options
    // needing a new one.
    if (picks.get(id)?.choice_role === "question" && field?.choice_role !== "question") {
      for (const [key, f] of next) {
        if (f.question_id === id) {
          const rest = { ...f };
          delete rest.question_id;
          delete rest.question_text;
          next.set(key, rest);
        }
      }
    }
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
                const answers = pick?.question_id
                  ? questions.find((q) => q.id === pick.question_id)?.text
                  : undefined;
                return (
                  <button
                    key={b.id}
                    type="button"
                    data-workflow-field
                    onClick={() => setOpenId(openId === b.id ? null : b.id)}
                    aria-pressed={Boolean(pick)}
                    aria-expanded={openId === b.id}
                    aria-label={`${label}${pick ? `: ${fieldTag(pick)}` : ""}`}
                    title={answers ? `${label} (option for ${answers})` : label}
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
                <FieldTypeMenu
                  key={open.id}
                  blank={open}
                  label={fieldLabel(open)}
                  value={picks.get(open.id) ?? null}
                  questions={questions}
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

export type ChoiceQuestion = { id: string; text: string };

type MenuItem = { label: string; field: Omit<WorkflowField, "id"> };

const MENU: MenuItem[] = [
  { label: "Contact", field: { type: "contact" } },
  { label: "Text", field: { type: "text" } },
  { label: "Text area", field: { type: "text_area" } },
  { label: "Decimal: Currency ($)", field: { type: "decimal", decimal_format: "currency" } },
  { label: "Decimal: Percentage (%)", field: { type: "decimal", decimal_format: "percentage" } },
  { label: "Date", field: { type: "date" } },
  { label: "Number", field: { type: "number" } },
  { label: "Choice question", field: { type: "choice", choice_role: "question" } },
];

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/50 focus:bg-accent-soft/50 focus:outline-none";

function Check({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="w-3.5 shrink-0 text-accent">
      {on ? "✓" : ""}
    </span>
  );
}

// The menu that drops down from a clicked field: its type, with Remove at
// the bottom. A choice option then asks which question it answers.
function FieldTypeMenu({
  blank,
  label,
  value,
  questions,
  onChange,
  onClose,
}: {
  blank: Field;
  label: string;
  value: WorkflowField | null;
  // Choice questions picked so far, most recent first.
  questions: ChoiceQuestion[];
  onChange: (field: WorkflowField | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"types" | "questions" | "new">(
    value?.choice_role === "option" && !value.question_id ? "questions" : "types",
  );
  const [newQuestion, setNewQuestion] = useState("");
  // Kept current so the listeners below are set up once, when it opens.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const close = () => closeRef.current();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      // Clicking another field switches to it (its own click handles that).
      if (ref.current?.contains(target) || target.closest("[data-workflow-field]")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Focus the first choice whenever the menu opens or changes view.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-menu-item], input")?.focus();
  }, [view]);

  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])];
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  }

  function choose(field: Omit<WorkflowField, "id">) {
    onChange({ id: blank.id, ...field });
    onClose();
  }

  // Open below the field, or above it near the bottom of the page, and keep
  // it on the page sideways.
  const below = blank.y + blank.height < 0.6;
  const fromRight = blank.x > 0.6;
  const style: React.CSSProperties = {
    ...(below
      ? { top: `calc(${(blank.y + blank.height) * 100}% + 4px)` }
      : { bottom: `calc(${(1 - blank.y) * 100}% + 4px)` }),
    ...(fromRight
      ? { right: `${Math.max(0, 1 - blank.x - blank.width) * 100}%` }
      : { left: `${blank.x * 100}%` }),
  };

  const isOption = value?.type === "choice" && value.choice_role === "option";
  const others = questions.filter((q) => q.id !== blank.id);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Field type for ${label}`}
      onKeyDown={onMenuKey}
      style={style}
      className="absolute z-20 flex w-60 flex-col rounded-lg border border-border bg-surface p-1 text-left shadow-lg"
    >
      {view === "types" ? (
        <>
          {MENU.map((item) => {
            const on =
              value?.type === item.field.type &&
              value?.decimal_format === item.field.decimal_format &&
              value?.choice_role === item.field.choice_role;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                data-menu-item
                onClick={() => choose(item.field)}
                className={itemClass}
              >
                <Check on={on} />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            data-menu-item
            onClick={() => setView("questions")}
            className={itemClass}
          >
            <Check on={isOption} />
            <span className="flex-1">Choice option</span>
            <span aria-hidden className="text-ink-faint">
              &rsaquo;
            </span>
          </button>
          {value && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                role="menuitem"
                data-menu-item
                onClick={() => {
                  onChange(null);
                  onClose();
                }}
                className={`${itemClass} text-danger hover:bg-danger/10 focus:bg-danger/10`}
              >
                <Check on={false} />
                Remove from workflow
              </button>
            </>
          )}
        </>
      ) : view === "questions" ? (
        <>
          <button
            type="button"
            role="menuitem"
            data-menu-item
            onClick={() => setView("types")}
            className={`${itemClass} text-xs font-semibold text-ink-soft`}
          >
            &lsaquo; Back
          </button>
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-ink-soft">
            Which choice question is this an option for?
          </p>
          <div className="max-h-56 overflow-y-auto">
            {others.map((q) => {
              const on = isOption && value?.question_id === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  data-menu-item
                  onClick={() =>
                    choose({
                      type: "choice",
                      choice_role: "option",
                      question_id: q.id,
                      ...(q.id.startsWith(NEW_QUESTION_PREFIX) ? { question_text: q.text } : {}),
                    })
                  }
                  className={itemClass}
                >
                  <Check on={on} />
                  <span className="min-w-0 flex-1 truncate" title={q.text}>
                    {q.text}
                  </span>
                </button>
              );
            })}
            {others.length === 0 && (
              <p className="px-2.5 py-1.5 text-xs text-ink-faint">
                No choice questions yet.
              </p>
            )}
          </div>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            data-menu-item
            onClick={() => setView("new")}
            className={`${itemClass} font-semibold text-accent`}
          >
            <span aria-hidden className="w-3.5 shrink-0">
              +
            </span>
            Add a new choice question
          </button>
        </>
      ) : (
        <form
          className="flex flex-col gap-2 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const text = newQuestion.trim();
            if (!text) return;
            choose({
              type: "choice",
              choice_role: "option",
              question_id: `${NEW_QUESTION_PREFIX}${crypto.randomUUID()}`,
              question_text: text,
            });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-soft">New choice question</span>
            <input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              maxLength={200}
              placeholder="e.g. Financing type"
              className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView("questions")}
              className="text-xs font-semibold text-ink-soft"
            >
              &lsaquo; Back
            </button>
            <button
              type="submit"
              disabled={!newQuestion.trim()}
              className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
