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
import { fieldOrderPlan, parseMap } from "@/lib/fieldMatch";

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
    case "contract_fields":
      return (
        <div className={wide}>
          <FieldOrder item={item} str={str} onChange={onChange} />
        </div>
      );
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

// Field Order: the field names on their contract (scanned from it), their
// field sections and fields copied from Open to Close, and each contract
// field matched to one of theirs. The order follows the contract.
function FieldOrder({
  item,
  str,
  onChange,
}: {
  item: Extract<ChecklistItem, { type: "contract_fields" }>;
  str: (k: string) => string;
  onChange: (key: string, value: string) => void;
}) {
  const otcKey = `${item.key}__current`;
  const mapKey = `${item.key}__map`;
  const contract = str(item.key);
  const plan = fieldOrderPlan(contract, str(otcKey), str(mapKey));
  const pick = (raw: string, key: string) => onChange(mapKey, JSON.stringify({ ...parseMap(str(mapKey)), [raw]: key }));
  const sections = [...new Set(plan.fields.map((f) => f.section))];
  const step = "text-xs font-bold uppercase tracking-wide text-ink-soft";
  const box = `${INPUT} h-56 resize-y font-mono text-[13px]`;
  return (
    <div className="flex flex-col gap-4">
      <span className={LABEL}>{item.label}</span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className={step}>1. Fields on their contract</span>
          <ContractFieldScanner
            onList={(names) => {
              if (contract.trim() && !window.confirm("Replace the contract fields below with this contract's?")) return;
              onChange(item.key, names.join("\n"));
            }}
          />
          <textarea
            value={contract}
            onChange={(e) => onChange(item.key, e.target.value)}
            placeholder={"Upload their contract, or type the field names\none per line, in contract order"}
            className={box}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className={step}>2. Their field sections and fields</span>
          <span className="text-xs text-ink-faint">Copy a field group&rsquo;s page in Open to Close and paste it here.</span>
          <textarea
            value={str(otcKey)}
            onChange={(e) => onChange(otcKey, e.target.value)}
            placeholder={"Details\nAll | None Add Field | Edit\nProperty Details\nAddress\nCity\n…"}
            className={`${box} sm:mt-auto`}
          />
        </div>
      </div>
      {plan.rows.length > 0 && plan.fields.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={step}>3. Matched in contract order</span>
          <div className="overflow-hidden rounded-lg border border-border">
            {plan.rows.map(({ line, field, suggested }, i) => (
              <div
                key={line.raw}
                className={`grid grid-cols-1 items-center gap-x-3 gap-y-1 border-b border-border-soft px-3 py-1.5 last:border-b-0 sm:grid-cols-[1fr_1.3fr] ${field ? "" : "bg-danger/5"}`}
              >
                <span className="min-w-0 text-sm text-ink">
                  <span className="mr-1.5 inline-block w-6 text-right text-ink-faint">{i + 1}.</span>
                  {line.label}
                  {line.where && <span className="ml-1.5 text-xs text-ink-faint">{line.where}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <select
                    value={field?.key ?? ""}
                    onChange={(e) => pick(line.raw, e.target.value)}
                    className={`${INPUT} py-1 ${field ? "" : "text-danger"}`}
                  >
                    <option value="">Add field (no match)</option>
                    {sections.map((sec) => {
                      const opts = plan.fields
                        .filter((f) => f.section === sec)
                        .map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.name}
                            {f.hidden ? " (hidden)" : ""}
                          </option>
                        ));
                      return sec ? (
                        <optgroup key={sec} label={sec}>
                          {opts}
                        </optgroup>
                      ) : (
                        opts
                      );
                    })}
                  </select>
                  {field?.section && <span className="hidden shrink-0 text-xs text-ink-faint lg:inline">{field.section}</span>}
                  {suggested && (
                    <span className="shrink-0 text-[11px] italic text-ink-faint" title="Matched by name. Pick another to change it.">
                      auto
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          {plan.notOnContract.length > 0 && (
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-ink-soft">
                Their fields not on the contract ({plan.notOnContract.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {sections.map((sec) => {
                  const fs = plan.notOnContract.filter((f) => f.section === sec);
                  return fs.length ? (
                    <div key={sec} className="text-xs text-ink">
                      {sec && <span className="font-semibold">{sec}: </span>}
                      {fs.map((f) => f.name).join(", ")}
                    </div>
                  ) : null;
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
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
