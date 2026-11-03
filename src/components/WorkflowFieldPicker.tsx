"use client";

import { useEffect, useRef, useState } from "react";
import { fieldLabel, type ContractBlank } from "@/lib/contractBlanks";
import { PdfPageCanvas, usePdfDocument } from "@/components/PdfPageCanvas";
import {
  CONTACT_ROLES_SECTION,
  isContactRole,
  kindMatches,
  OTC_FIELDS,
  OTC_SECTIONS,
  sectionById,
  type OtcField,
} from "@/lib/otcFields";
import {
  cleanWorkflowFields,
  fieldTag,
  isActive,
  isComplete,
  NEW_OTC_PREFIX,
  needsOtcField,
  newOtcFieldsFrom,
  workflowKeys,
  type WorkflowField,
} from "@/lib/workflowFields";

type Field = ContractBlank & { id: string };


// Shows a contract page by page with every field from the review outlined.
// Clicking a field drops down a menu of workflow field types; choosing one
// adds it to the workflow. Removing one grays it out until it's restored.
// Boxes linked in the review act as one field. A choice option is tied to a
// choice field. Changes go to `onSave` shortly after each one; without
// it, they stay on this screen.
export function WorkflowFieldPicker({
  source,
  pageCount,
  blanks,
  initialFields,
  extraOtcFields = [],
  onSave,
  onChange,
}: {
  source: ArrayBuffer | string;
  pageCount: number;
  blanks: ContractBlank[];
  initialFields: WorkflowField[];
  // OTC fields the client added on their other contracts.
  extraOtcFields?: OtcField[];
  onSave?: (fields: WorkflowField[]) => Promise<{ ok: boolean }>;
  // Called with every change, as it happens.
  onChange?: (fields: WorkflowField[]) => void;
}) {
  const { doc, error } = usePdfDocument(source);
  const [page, setPage] = useState(1);
  const [picks, setPicks] = useState(
    () =>
      new Map(
        cleanWorkflowFields(initialFields, workflowKeys(blanks)).map(
          (f) => [f.id, f] as const,
        ),
      ),
  );
  // The box that was clicked (its menu opens under it).
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    "saving" | "saved" | "error" | null
  >(null);
  const timer = useRef<number | null>(null);

  const fields = blanks
    .filter((b): b is Field => Boolean(b.id))
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const keyOf = (b: Field) => b.group ?? b.id;
  // The boxes behind each field, in reading order.
  const members = new Map<string, Field[]>();
  for (const b of fields)
    members.set(keyOf(b), [...(members.get(keyOf(b)) ?? []), b]);
  const labelOf = (key: string) => {
    const first = members.get(key)?.[0];
    return first ? fieldLabel(first) : "Unlabeled field";
  };

  const onPage = fields.filter((b) => b.page === page);
  const active = [...picks.values()].filter(isActive);
  const pickedOn = (n: number) =>
    active.filter((f) => members.get(f.id)?.some((b) => b.page === n));
  const incomplete = active.filter((f) => !isComplete(f)).length;
  const open = onPage.find((b) => b.id === openId) ?? null;

  // Built-in OTC fields, plus the ones the client has added.
  const otcFields = [
    ...OTC_FIELDS,
    ...[...newOtcFieldsFrom(active), ...extraOtcFields].filter(
      (f, i, all) => all.findIndex((g) => g.id === f.id) === i,
    ),
  ];
  const otcName = (id?: string) =>
    id ? otcFields.find((f) => f.id === id)?.name : undefined;

  // The name of the choice field an option belongs to: an OTC choice field,
  // or (saved before options were tied to OTC fields) a choice field picked
  // on the contract or a question typed in.
  const choiceName = (id?: string) => {
    if (!id) return undefined;
    const otc = otcName(id);
    if (otc) return otc;
    const legacy = picks.get(id);
    if (legacy) {
      const first = members.get(id)?.[0];
      return otcName(legacy.otc_field) ?? (first ? `Page ${first.page}: ${fieldLabel(first)}` : undefined);
    }
    return [...picks.values()].find((f) => f.question_id === id && f.question_text)?.question_text;
  };

  // OTC choice fields used on this contract (by a choice field or an
  // option), most recent first.
  const recentChoices: string[] = [];
  for (const f of active) {
    const id =
      f.type !== "choice" ? undefined : f.choice_role === "question" ? f.otc_field : f.question_id;
    if (!id || !otcFields.some((o) => o.id === id)) continue;
    const at = recentChoices.indexOf(id);
    if (at >= 0) recentChoices.splice(at, 1);
    recentChoices.unshift(id);
  }

  function update(next: Map<string, WorkflowField>) {
    setPicks(next);
    onChange?.([...next.values()]);
    if (!onSave) return;
    if (timer.current) window.clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = window.setTimeout(async () => {
      const result = await onSave([...next.values()]);
      setSaveState(result.ok ? "saved" : "error");
    }, 600);
  }

  function setField(key: string, field: WorkflowField | null) {
    const next = new Map(picks);
    if (field) next.set(key, field);
    else next.delete(key);
    // A field that stops being a choice field (changed or removed)
    // leaves its options needing a new one.
    const isQuestion = (f?: WorkflowField | null) =>
      Boolean(f && isActive(f) && f.choice_role === "question");
    if (isQuestion(picks.get(key)) && !isQuestion(field)) {
      for (const [k, f] of next) {
        if (f.question_id === key) {
          const rest = { ...f };
          delete rest.question_id;
          delete rest.question_text;
          next.set(k, rest);
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
            const needsAnswer = picked.some((f) => !isComplete(f));
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
          {active.length} workflow field{active.length === 1 ? "" : "s"} picked
          {incomplete > 0 && (
            <span className="font-semibold text-danger">
              {" "}
              &middot; {incomplete} need{incomplete === 1 ? "s" : ""} an answer
            </span>
          )}
          {saveState === "saving" && " · Saving…"}
          {saveState === "saved" && " · Saved"}
          {saveState === "error" && (
            <span className="text-danger"> · Couldn&rsquo;t save</span>
          )}
        </span>
      </div>

      <p className="text-sm text-ink-soft">
        Click each field your team needs to track during a transaction and
        choose what kind of field it is. Fields you don&rsquo;t need can be
        removed; they&rsquo;re grayed out, and clicking one lets you restore it.
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
                const key = keyOf(b);
                const pick = picks.get(key);
                const removed = Boolean(pick?.removed);
                const picked = Boolean(pick && !removed);
                const done = pick ? isComplete(pick) : false;
                const linked = (members.get(key)?.length ?? 0) > 1;
                // The tag goes on the field's first box on this page.
                const showTag =
                  members.get(key)?.find((m) => m.page === page)?.id === b.id;
                const label = labelOf(key);
                const answers = choiceName(pick?.question_id);
                const isOpen = open !== null && keyOf(open) === key;
                return (
                  <button
                    key={b.id}
                    type="button"
                    data-workflow-field
                    onClick={() => setOpenId(isOpen ? null : b.id)}
                    onPointerEnter={() => linked && setHoverKey(key)}
                    onPointerLeave={() => setHoverKey(null)}
                    aria-pressed={picked}
                    aria-expanded={isOpen}
                    aria-label={`${label}${linked ? " (linked lines)" : ""}${
                      removed ? ": removed" : pick ? `: ${fieldTag(pick)}` : ""
                    }`}
                    title={
                      removed
                        ? `${label} (removed)`
                        : answers
                          ? `${pick?.option_title ?? label} (option for ${answers})`
                          : pick?.otc_field
                            ? `${label} → OTC: ${otcName(pick.otc_field)}`
                            : label
                    }
                    className={`absolute rounded-sm border-2 transition-colors ${
                      removed
                        ? "border-zinc-400 bg-zinc-400/40 hover:bg-zinc-400/55"
                        : !pick
                          ? "border-gold/70 bg-gold/10 hover:bg-gold/30"
                          : done
                            ? "border-accent bg-accent/30"
                            : "border-danger bg-danger/15"
                    } ${
                      isOpen
                        ? "ring-2 ring-accent ring-offset-1"
                        : hoverKey === key
                          ? "ring-2 ring-accent/50"
                          : ""
                    }`}
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.width * 100}%`,
                      height: `${b.height * 100}%`,
                    }}
                  >
                    {picked && pick && showTag && (
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
                  key={keyOf(open)}
                  blank={open}
                  fieldKey={keyOf(open)}
                  label={labelOf(keyOf(open))}
                  value={picks.get(keyOf(open)) ?? null}
                  recentChoices={recentChoices}
                  otcFields={otcFields}
                  onChange={(f) => setField(keyOf(open), f)}
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
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-zinc-400 bg-zinc-400/40" />
          Removed
        </span>
      </div>
    </div>
  );
}


type MenuItem = {
  label: string;
  help: string;
  field: Omit<WorkflowField, "id">;
};

// Each type, with the help shown while it's hovered.
const MENU: MenuItem[] = [
  {
    label: "Contact",
    help: "This includes contact information for a partner of the transaction.",
    field: { type: "contact" },
  },
  {
    label: "Text",
    help: "This is a short string of text, but could also be numbers that don't require calculation, like a parcel or MLS number.",
    field: { type: "text" },
  },
  {
    label: "Text area",
    help: "This should be text that is typically longer and may need formatting (bold, italic, underline, etc.).",
    field: { type: "text_area" },
  },
  {
    label: "Decimal: Dollar ($)",
    help: "This will appear as a dollar amount. Example: $500,000",
    field: { type: "decimal", decimal_format: "currency" },
  },
  {
    label: "Decimal: Percentage (%)",
    help: "This will appear as a percentage. Example: 30%",
    field: { type: "decimal", decimal_format: "percentage" },
  },
  {
    label: "Date",
    help: "This is a typical date field.",
    field: { type: "date" },
  },
  {
    label: "Number",
    help: "This will appear as a number without commas or dashes and is designed to work with the Date Calculation tool.",
    field: { type: "number" },
  },
  {
    label: "Choice field",
    help: "This is a field that has multiple items to select from.",
    field: { type: "choice", choice_role: "question" },
  },
];

const CHOICE_OPTION_HELP =
  "This is an option in a field with multiple selections and belongs under a specific choice field.";
const DEFAULT_HELP = "Hover over a type to see what it's for.";

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink hover:bg-accent-soft/50 focus-visible:bg-accent-soft/50 focus:outline-none";

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
  fieldKey,
  label,
  value,
  recentChoices,
  otcFields,
  onChange,
  onClose,
}: {
  // The box that was clicked, and the key of the field it belongs to.
  blank: Field;
  fieldKey: string;
  label: string;
  value: WorkflowField | null;
  // OTC choice fields used on this contract, most recent first.
  recentChoices: string[];
  // Open to Close fields it can be assigned to: the built-in ones and any
  // the client has added.
  otcFields: OtcField[];
  onChange: (field: WorkflowField | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<
    "types" | "questions" | "new" | "otc" | "otc-new" | "option-title"
  >(
    value?.choice_role === "option" && !value.question_id
      ? "questions"
      : value?.choice_role === "option" && !value.option_title
        ? "option-title"
        : value && !value.removed && needsOtcField(value) && !value.otc_field
        ? "otc"
        : "types",
  );
  const [help, setHelp] = useState<string | null>(null);
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
      if (
        ref.current?.contains(target) ||
        target.closest("[data-workflow-field]")
      )
        return;
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
    (
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      ref.current?.querySelector<HTMLElement>("[data-menu-item], input")
    )?.focus();
  }, [view]);

  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [
      ...(ref.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? []),
    ];
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? (i + 1) % items.length
        : (i - 1 + items.length) % items.length;
    items[next].focus();
  }

  function choose(field: Omit<WorkflowField, "id">) {
    const next: WorkflowField = { id: fieldKey, ...field };
    // Keeping the same type keeps its OTC field.
    const sameType =
      value?.type === next.type &&
      value?.decimal_format === next.decimal_format &&
      value?.choice_role === next.choice_role;
    if (sameType && value?.otc_field) {
      next.otc_field = value.otc_field;
      if (value.otc_field_name) next.otc_field_name = value.otc_field_name;
      if (value.otc_section) next.otc_section = value.otc_section;
    }
    onChange(next);
    // Then ask which Open to Close field it fills.
    if (needsOtcField(next)) setView("otc");
    else onClose();
  }

  function assignOtc(field: OtcField) {
    if (!value) return;
    const next: WorkflowField = { ...value, otc_field: field.id };
    delete next.otc_field_name;
    delete next.otc_section;
    if (field.isNew) {
      next.otc_field_name = field.name;
      next.otc_section = field.sectionId;
    }
    onChange(next);
    onClose();
  }

  const assigned = value?.otc_field
    ? otcFields.find((f) => f.id === value.otc_field)
    : undefined;

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
  const isContact = value?.type === "contact";
  const otcPool = otcFields.filter((f) => isContactRole(f) === isContact);
  const choicePool = otcFields.filter((f) => !isContactRole(f) && f.kind === "choice");
  const recentChoiceFields = recentChoices
    .map((id) => choicePool.find((f) => f.id === id))
    .filter((f): f is OtcField => Boolean(f));

  // An option is tied to its choice field, then asked for its title.
  function chooseChoiceField(field: OtcField) {
    onChange({
      id: fieldKey,
      type: "choice",
      choice_role: "option",
      question_id: field.id,
      ...(field.isNew ? { question_text: field.name, question_section: field.sectionId } : {}),
      ...(isOption && value?.option_title ? { option_title: value.option_title } : {}),
    });
    setView("option-title");
  }

  const optionOf = isOption
    ? (otcFields.find((f) => f.id === value?.question_id)?.name ?? value?.question_text)
    : undefined;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Field type for ${label}`}
      onKeyDown={onMenuKey}
      style={style}
      className="absolute z-20 flex w-72 flex-col rounded-lg border border-border bg-surface p-1 text-left shadow-lg"
    >
      {value?.removed ? (
        // A removed field only offers to come back, with its answers.
        <button
          type="button"
          role="menuitem"
          data-menu-item
          onClick={() => {
            if (value.type) {
              const restored = { ...value };
              delete restored.removed;
              onChange(restored);
            } else {
              onChange(null);
            }
            onClose();
          }}
          className={`${itemClass} font-semibold text-accent`}
        >
          <span aria-hidden className="w-3.5 shrink-0">
            &#8634;
          </span>
          Restore to workflow
        </button>
      ) : view === "types" ? (
        <>
          {isOption && optionOf && (
            <>
              <button
                type="button"
                role="menuitem"
                data-menu-item
                onClick={() => setView("option-title")}
                className={`${itemClass} flex-col !items-start gap-0`}
              >
                <span className="text-[11px] font-medium text-ink-faint">
                  Option for {optionOf}
                </span>
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {value?.option_title || "No title yet"}
                  </span>
                  <span className="text-xs font-semibold text-accent">Change</span>
                </span>
              </button>
              <div className="my-1 border-t border-border" />
            </>
          )}
          {assigned && (
            <>
              <button
                type="button"
                role="menuitem"
                data-menu-item
                onClick={() => setView("otc")}
                className={`${itemClass} flex-col !items-start gap-0`}
              >
                <span className="text-[11px] font-medium text-ink-faint">
                  {isContactRole(assigned) ? "Contact role" : "OTC field"}
                </span>
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {assigned.name}
                  </span>
                  <span className="text-xs font-semibold text-accent">
                    Change
                  </span>
                </span>
              </button>
              <div className="my-1 border-t border-border" />
            </>
          )}
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
                onPointerEnter={() => setHelp(item.help)}
                onFocus={(e) =>
                  e.currentTarget.matches(":focus-visible") &&
                  setHelp(item.help)
                }
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
            onPointerEnter={() => setHelp(CHOICE_OPTION_HELP)}
            onFocus={(e) =>
              e.currentTarget.matches(":focus-visible") &&
              setHelp(CHOICE_OPTION_HELP)
            }
            className={itemClass}
          >
            <Check on={isOption} />
            <span className="flex-1">Choice option</span>
            <span aria-hidden className="text-ink-faint">
              &rsaquo;
            </span>
          </button>
          {/* Always last. The field stays on the page, grayed out. */}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            data-menu-item
            onClick={() => {
              onChange({ ...(value ?? { id: fieldKey }), removed: true });
              onClose();
            }}
            className={`${itemClass} !text-danger hover:!bg-danger/10 focus-visible:!bg-danger/10`}
          >
            <Check on={false} />
            Remove from workflow
          </button>
          {/* What the hovered (or focused) type is for. */}
          <p
            aria-live="polite"
            className="mt-1 min-h-[4.25rem] rounded-md bg-bg px-2.5 py-2 text-xs leading-snug text-ink-soft"
          >
            {help ?? DEFAULT_HELP}
          </p>
        </>
      ) : view === "questions" ? (
        <OtcFieldList
          title="Which choice field is this an option for?"
          backLabel="Field type"
          pool={choicePool}
          recent={recentChoiceFields}
          selectedId={isOption ? value?.question_id : undefined}
          searchPlaceholder="Search choice fields"
          emptyText="No choice fields match."
          addLabel="Add a new choice field"
          onPick={chooseChoiceField}
          onAddNew={() => setView("new")}
          onBack={() => setView("types")}
        />
      ) : view === "new" ? (
        <NewOtcFieldForm
          defaultName=""
          kind="choice"
          onAdd={(name, sectionId) =>
            chooseChoiceField({
              id: `${NEW_OTC_PREFIX}${crypto.randomUUID()}`,
              name,
              sectionId,
              isNew: true,
            })
          }
          onBack={() => setView("questions")}
        />
      ) : view === "option-title" && value ? (
        <OptionTitleForm
          choiceField={optionOf ?? "this choice field"}
          // The contract's text next to a checkbox (like "Conventional,") is
          // usually the option's title.
          defaultTitle={
            value.option_title ??
            (label === "Unlabeled field" ? "" : label.replace(/[\s,:;.]+$/, ""))
          }
          onSave={(title) => {
            onChange({ ...value, option_title: title });
            onClose();
          }}
          onChangeField={() => setView("questions")}
        />
      ) : view === "otc" && value ? (
        <OtcFieldList
          title={
            isContact
              ? "Which contact role is this in Open to Close?"
              : "Which Open to Close field does this fill?"
          }
          backLabel="Field type"
          pool={otcPool}
          suggested={
            isContact
              ? []
              : otcPool.filter((f) => kindMatches(f.kind, value.type, value.decimal_format))
          }
          suggestedLabel={`Suggested for ${
            TYPE_NAMES[(value.type === "decimal" ? value.decimal_format : value.type) ?? ""] ?? ""
          } fields`}
          selectedId={value.otc_field}
          searchPlaceholder={isContact ? "Search contact roles" : "Search OTC fields"}
          emptyText={isContact ? "No contact roles match." : "No OTC fields match."}
          addLabel={isContact ? "Add a new contact role" : "Add a new OTC field"}
          onPick={assignOtc}
          onAddNew={() => setView("otc-new")}
          onBack={() => setView("types")}
        />
      ) : (
        <NewOtcFieldForm
          // A contract's label (like "BUYER: The undersigned") makes a fine
          // field name, but not a contact role.
          defaultName={
            value?.type === "contact" || label === "Unlabeled field"
              ? ""
              : label.replace(/[:\s]+$/, "")
          }
          kind={value?.type === "contact" ? "contact" : "field"}
          onAdd={(name, sectionId) =>
            assignOtc({
              id: `${NEW_OTC_PREFIX}${crypto.randomUUID()}`,
              name,
              sectionId,
              isNew: true,
            })
          }
          onBack={() => setView("otc")}
        />
      )}
    </div>
  );
}

const TYPE_NAMES: Record<string, string> = {
  contact: "contact",
  text: "text",
  text_area: "text area",
  currency: "dollar",
  percentage: "percentage",
  date: "date",
  number: "number",
  choice: "choice",
};

// Which Open to Close field a workflow field fills: the ones that match its
// type first, a search, and a way to add a new one.
function OtcFieldList({
  title,
  backLabel,
  pool,
  suggested = [],
  suggestedLabel,
  recent = [],
  selectedId,
  searchPlaceholder,
  emptyText,
  addLabel,
  onPick,
  onAddNew,
  onBack,
}: {
  title: string;
  backLabel: string;
  // Everything that can be picked.
  pool: OtcField[];
  // Shown first, with a way to show the whole pool.
  suggested?: OtcField[];
  suggestedLabel?: string;
  // Used recently; listed at the top.
  recent?: OtcField[];
  selectedId?: string;
  searchPlaceholder: string;
  emptyText: string;
  addLabel: string;
  onPick: (field: OtcField) => void;
  onAddNew: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const q = query.trim().toLowerCase();
  const sectionName = (f: OtcField) =>
    sectionById(f.sectionId)?.name ?? "Your new fields";
  const list = q
    ? pool.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          sectionName(f).toLowerCase().includes(q),
      )
    : showAll || suggested.length === 0
      ? pool
      : suggested;

  // Grouped by section, in the order OTC shows them; new fields without a
  // section come last. Recently used ones lead when not searching.
  const order = new Map(OTC_SECTIONS.map((s, i) => [s.id, i] as const));
  const sections = new Map<string, OtcField[]>();
  if (!q && recent.length > 0) sections.set("Recently used", recent);
  for (const f of [...list].sort(
    (a, b) => (order.get(a.sectionId) ?? 999) - (order.get(b.sectionId) ?? 999),
  )) {
    const key = sectionName(f);
    sections.set(key, [...(sections.get(key) ?? []), f]);
  }

  return (
    <>
      <button
        type="button"
        role="menuitem"
        data-menu-item
        onClick={onBack}
        className={`${itemClass} text-xs font-semibold text-ink-soft`}
      >
        &lsaquo; {backLabel}
      </button>
      <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-ink-soft">{title}</p>
      <div className="px-1.5 pb-1.5">
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>
      {!q && suggested.length > 0 && (
        <p className="px-2.5 pb-1 text-[11px] text-ink-faint">
          {showAll ? "All OTC fields" : suggestedLabel}
        </p>
      )}
      <div className="max-h-60 overflow-y-auto">
        {[...sections].map(([section, items]) => (
          <div key={section} role="group" aria-label={section}>
            <p className="sticky top-0 bg-surface px-2.5 pb-0.5 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {section}
            </p>
            {items.map((f) => {
              const on = selectedId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  data-menu-item
                  onClick={() => onPick(f)}
                  className={itemClass}
                >
                  <Check on={on} />
                  <span className="min-w-0 flex-1">{f.name}</span>
                </button>
              );
            })}
          </div>
        ))}
        {list.length === 0 && (
          <p className="px-2.5 py-1.5 text-xs text-ink-faint">{emptyText}</p>
        )}
      </div>
      {!q && suggested.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="px-2.5 py-1.5 text-left text-xs font-semibold text-accent"
        >
          {showAll ? "Show suggested fields only" : "Show all OTC fields"}
        </button>
      )}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        role="menuitem"
        data-menu-item
        onClick={onAddNew}
        className={`${itemClass} font-semibold text-accent`}
      >
        <span aria-hidden className="w-3.5 shrink-0">
          +
        </span>
        {addLabel}
      </button>
    </>
  );
}

// Adds a field the client wants in Open to Close that isn't one of the
// built-in ones.
function NewOtcFieldForm({
  defaultName,
  kind,
  onAdd,
  onBack,
}: {
  defaultName: string;
  // A contact role (which has no section to choose), a choice field, or
  // any other field.
  kind: "contact" | "choice" | "field";
  onAdd: (name: string, sectionId: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [sectionId, setSectionId] = useState(
    kind === "contact" ? CONTACT_ROLES_SECTION : "",
  );
  const sections = OTC_SECTIONS.filter((s) => s.id !== CONTACT_ROLES_SECTION);
  const groups = [...new Set(sections.map((s) => s.group))];
  const ready = name.trim() && sectionId;

  return (
    <form
      className="flex flex-col gap-2.5 p-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAdd(name.trim(), sectionId);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft">
          {kind === "contact"
            ? "New contact role"
            : kind === "choice"
              ? "New choice field name"
              : "New OTC field name"}
        </span>
        <input
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={
            kind === "contact"
              ? "e.g. Surveyor"
              : kind === "choice"
                ? "e.g. Survey Required"
                : "e.g. Home Warranty Company"
          }
          className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </label>
      {kind !== "contact" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-soft">
            Section it goes in
          </span>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">Choose a section&hellip;</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {sections
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-ink-soft"
        >
          &lsaquo; Back
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {kind === "contact" ? "Add role" : "Add field"}
        </button>
      </div>
    </form>
  );
}

// Asks what a choice option is called in its choice field's list.
function OptionTitleForm({
  choiceField,
  defaultTitle,
  onSave,
  onChangeField,
}: {
  choiceField: string;
  defaultTitle: string;
  onSave: (title: string) => void;
  onChangeField: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);

  return (
    <form
      className="flex flex-col gap-2.5 p-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave(title.trim());
      }}
    >
      <p className="text-xs text-ink-soft">
        Option for <span className="font-semibold text-ink">{choiceField}</span>
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft">Option title</span>
        <input
          data-autofocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Conventional"
          className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
      </label>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onChangeField}
          className="text-xs font-semibold text-ink-soft"
        >
          &lsaquo; Choice field
        </button>
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save option
        </button>
      </div>
    </form>
  );
}
