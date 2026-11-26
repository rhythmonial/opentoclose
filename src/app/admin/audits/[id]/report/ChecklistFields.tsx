"use client";

import { useEffect, useRef, useState } from "react";
import {
  AUDIT_CHECKLIST,
  duplicateNames,
  withCommas,
  type ChecklistItem,
  type ChecklistValues,
} from "@/lib/auditChecklist";
import { ContractFieldScanner } from "./ContractFieldScanner";

const INPUT =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const LABEL = "text-sm font-medium text-ink";

// Josie's audit checklist: each step's sections and items, filled in as
// she audits. `onChange` gets an item's key and its new value.
export function ChecklistFields({
  values,
  onChange,
}: {
  values: ChecklistValues;
  onChange: (key: string, value: string | boolean | string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {AUDIT_CHECKLIST.map((step, i) => (
        <section key={step.key} className="rounded-xl border border-border bg-surface">
          <h2 className="rounded-t-xl bg-navy px-5 py-3 font-display text-lg font-bold text-white">
            <span className="text-gold">Step {i + 1}</span> &middot; {step.title}
          </h2>
          <div className="flex flex-col gap-5 p-5">
            {step.sections.map((sec, j) => (
              <div key={sec.title ?? j} className="flex flex-col gap-3">
                {sec.title && (
                  <h3 className="border-b border-border-soft pb-1 font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
                    {sec.title}
                  </h3>
                )}
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  {sec.items.map((item) => (
                    <Item key={item.key} item={item} values={values} onChange={onChange} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Item({
  item,
  values,
  onChange,
}: {
  item: ChecklistItem;
  values: ChecklistValues;
  onChange: (key: string, value: string | boolean | string[]) => void;
}) {
  const str = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : "");
  const arr = (k: string) => (Array.isArray(values[k]) ? (values[k] as string[]) : []);
  const wide = "sm:col-span-2";

  switch (item.type) {
    case "text":
      return (
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{item.label}</span>
          <input value={str(item.key)} onChange={(e) => onChange(item.key, e.target.value)} className={INPUT} />
        </label>
      );
    case "textarea":
      return (
        <label className={`flex flex-col gap-1.5 ${wide}`}>
          <span className={LABEL}>{item.label}</span>
          <textarea
            value={str(item.key)}
            onChange={(e) => onChange(item.key, e.target.value)}
            rows={2}
            placeholder={item.placeholder ?? "Your recommendations (Markdown works: - bullets, **bold**)"}
            className={`${INPUT} [field-sizing:content]`}
          />
        </label>
      );
    case "select":
      return (
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{item.label}</span>
          <select value={str(item.key)} onChange={(e) => onChange(item.key, e.target.value)} className={INPUT}>
            <option value="">Select&hellip;</option>
            {item.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    case "multiselect":
    case "checklist":
      return (
        <div className={`flex flex-col gap-1.5 ${wide}`}>
          <span className={LABEL}>{item.label}</span>
          <Multi options={item.options} value={arr(item.key)} onChange={(v) => onChange(item.key, v)} />
        </div>
      );
    case "number":
      return <NumberItem item={item} value={str(item.key)} onChange={(v) => onChange(item.key, v)} />;
    case "check": {
      const on = values[item.key] === true;
      const detailKey = `${item.key}__detail`;
      return (
        <div className={`flex flex-col gap-2 ${on && item.detail && item.detail.type !== "text" ? wide : ""}`}>
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onChange(item.key, e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span className={LABEL}>{item.label}</span>
          </label>
          {on && item.detail && (
            <div className="ml-6 flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-soft">{item.detail.label}</span>
              {item.detail.type === "text" ? (
                <input value={str(detailKey)} onChange={(e) => onChange(detailKey, e.target.value)} className={INPUT} />
              ) : item.detail.type === "textarea" ? (
                <textarea
                  value={str(detailKey)}
                  onChange={(e) => onChange(detailKey, e.target.value)}
                  rows={3}
                  className={`${INPUT} [field-sizing:content]`}
                />
              ) : (
                <Multi options={item.detail.options ?? []} value={arr(detailKey)} onChange={(v) => onChange(detailKey, v)} />
              )}
            </div>
          )}
        </div>
      );
    }
    case "yesno": {
      const v = str(item.key);
      return (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{item.label}</span>
          <div className="flex gap-4 text-sm text-ink">
            {["yes", "no"].map((o) => (
              <label key={o} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={v === o}
                  onChange={() => onChange(item.key, o)}
                  onClick={() => v === o && onChange(item.key, "")}
                  className="h-4 w-4"
                />
                {o === "yes" ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </div>
      );
    }
    case "toggle":
      return (
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={values[item.key] === true}
            onChange={(e) => onChange(item.key, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className={LABEL}>{item.label}</span>
        </label>
      );
    case "contract_fields": {
      const current = str(item.key);
      return (
        <div className={`flex flex-col gap-2 ${wide}`}>
          <span className={LABEL}>{item.label}</span>
          <ContractFieldScanner
            onList={(lines) => {
              if (current.trim() && !window.confirm("Replace the field list below with this contract's fields?")) return;
              onChange(item.key, lines.join("\n"));
            }}
          />
          <textarea
            value={current}
            onChange={(e) => onChange(item.key, e.target.value)}
            rows={6}
            placeholder={"One field per line, in the order you recommend.\nUpload their contract to fill this in, then edit and reorder."}
            className={`${INPUT} [field-sizing:content] max-h-[32rem] font-mono text-[13px]`}
          />
          <span className="text-xs text-ink-faint">
            Each line is a field; cut and paste lines to reorder them, and edit or delete any. The report lists them in this order.
          </span>
        </div>
      );
    }
    case "duplicates": {
      const dups = duplicateNames(str(item.key));
      const any = str(item.key).trim().length > 0;
      return (
        <div className={`flex flex-col gap-1.5 ${wide}`}>
          <span className={LABEL}>{item.label}</span>
          <textarea
            value={str(item.key)}
            onChange={(e) => onChange(item.key, e.target.value)}
            rows={3}
            placeholder="Paste template names here, one per line"
            className={`${INPUT} [field-sizing:content] max-h-72`}
          />
          {any && (
            <div className={`rounded-lg px-3 py-2 text-sm ${dups.length ? "bg-danger/5 text-danger" : "bg-success-soft text-success"}`}>
              {dups.length ? (
                <>
                  <span className="font-semibold">{dups.length} duplicate{dups.length === 1 ? "" : "s"}:</span> {dups.join(", ")}
                </>
              ) : (
                "No duplicates found."
              )}
            </div>
          )}
        </div>
      );
    }
  }
}

// Digits only (a percent can have a decimal point). Anything else typed is
// dropped, with a note saying so rather than seeming not to type.
function NumberItem({
  item,
  value,
  onChange,
}: {
  item: Extract<ChecklistItem, { type: "number" }>;
  value: string;
  onChange: (v: string) => void;
}) {
  const [dropped, setDropped] = useState(false);
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{item.label}</span>
      <span className="relative">
        <input
          inputMode={item.percent ? "decimal" : "numeric"}
          value={item.percent ? value.replace(/[^\d.]/g, "") : withCommas(value)}
          onChange={(e) => {
            const typed = e.target.value;
            const keep = item.percent ? typed.replace(/[^\d.]/g, "").slice(0, 6) : typed.replace(/\D/g, "").slice(0, 12);
            setDropped(/[^\d.,\s%]/.test(typed));
            onChange(keep);
          }}
          onBlur={() => setDropped(false)}
          className={`${INPUT} ${item.percent ? "pr-8" : ""}`}
        />
        {item.percent && <span className="absolute inset-y-0 right-3 flex items-center text-sm text-ink-faint">%</span>}
      </span>
      {dropped && <span className="text-xs text-danger">Numbers only</span>}
    </label>
  );
}

// Chips for what's chosen and a dropdown checklist to choose more.
function Multi({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-[2.4rem] w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-left"
      >
        {value.length === 0 && <span className="px-1 text-sm text-ink-faint">Select&hellip;</span>}
        {value.map((v) => (
          <span key={v} className="rounded-full border border-border bg-surface px-2 py-px text-xs text-ink">
            {v}
          </span>
        ))}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-lg border border-border bg-surface p-1.5 shadow-lg">
          {options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-accent-soft/40">
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="h-4 w-4" />
              <span className={/[{[%]/.test(o) ? "font-mono text-[13px]" : ""}>{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
