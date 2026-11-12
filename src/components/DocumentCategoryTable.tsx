"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_COLORS,
  PRIORITIES,
  sortByName,
  templateSidesFor,
  type DocCategory,
} from "@/lib/documentCategories";
import { addCategory, saveDocument } from "@/app/configurator/categorize_your_documents/actions";

export type CategoryRow = {
  contractDocumentId: string;
  name: string;
  // Its side from Upload Your Contracts.
  side: string | null;
  category: string | null;
  priority: string | null;
};

const ADD = "__add__";

// Categorize Your Documents: their uploaded contracts in a table grouped by
// side (from Upload Your Contracts), then by category. Each row has the
// side's letter, the document, its priority and its category.
export function DocumentCategoryTable({
  accountId,
  initialRows,
  starterCategories,
  initialCustom,
  sides,
  abbreviations,
}: {
  accountId: string | null;
  initialRows: CategoryRow[];
  starterCategories: DocCategory[];
  initialCustom: DocCategory[];
  // Every side, in order (Buyer, Seller, Transaction, Listing, Other, theirs).
  sides: string[];
  abbreviations: Record<string, string>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [custom, setCustom] = useState(initialCustom);
  const categories = sortByName([...starterCategories, ...custom]);
  const nameOf = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;

  async function save(row: CategoryRow, patch: Partial<CategoryRow>) {
    const next = { ...row, ...patch };
    setRows((all) => all.map((r) => (r.contractDocumentId === row.contractDocumentId ? next : r)));
    const res = await saveDocument(accountId, {
      contractDocumentId: next.contractDocumentId,
      name: next.name,
      categories: next.category ? [next.category] : [],
      sides: templateSidesFor(next.side),
      priority: next.priority,
    });
    if (!res.ok) window.alert(res.error ?? "Couldn't save.");
    router.refresh();
  }

  async function addOwn(row: CategoryRow) {
    const name = window.prompt("Name your category")?.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!name) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return save(row, { category: existing.id });
    const res = await addCategory(accountId, name, "gray");
    if (!res.ok || !res.id) return window.alert(res.error ?? "Couldn't add it.");
    setCustom((all) => [...all, { id: res.id!, name, color: "gray" }]);
    await save(row, { category: res.id });
  }

  // Sides in order, then (within each) categories A to Z with uncategorized
  // last.
  const sideOrder = [...sides, null];
  const groups = sideOrder
    .map((side) => {
      const inSide = rows.filter((r) =>
        side === null ? !r.side || !sides.includes(r.side) : r.side === side,
      );
      const byCategory = new Map<string, CategoryRow[]>();
      for (const r of inSide) {
        const key = nameOf(r.category) ?? "";
        byCategory.set(key, [...(byCategory.get(key) ?? []), r]);
      }
      const subgroups = [...byCategory.entries()].sort(([a], [b]) =>
        a === "" ? 1 : b === "" ? -1 : a.localeCompare(b),
      );
      return { side, count: inSide.length, subgroups };
    })
    .filter((g) => g.count > 0);

  const select =
    "w-full rounded-md border px-2 py-1 text-sm outline-none focus:border-accent";

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-soft bg-bg font-caption text-xs font-bold uppercase tracking-wide text-ink-faint">
            <th className="w-14 px-4 py-3">Side</th>
            <th className="px-4 py-3">Document</th>
            <th className="w-32 px-4 py-3">Priority</th>
            <th className="w-56 px-4 py-3">Category</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => [
            <tr key={`side-${g.side ?? "none"}`} className="border-b border-border-soft bg-accent-soft/40">
              <td colSpan={4} className="px-4 py-2 font-caption text-xs font-bold uppercase tracking-wide text-accent">
                {g.side ?? "No side yet (pick one in Upload Your Contracts)"} ({g.count})
              </td>
            </tr>,
            ...g.subgroups.flatMap(([category, list]) => [
              <tr key={`cat-${g.side}-${category}`} className="border-b border-border-soft bg-bg">
                <td colSpan={4} className="px-4 py-1.5 pl-8 text-xs font-semibold text-ink-soft">
                  {category || "Needs a category"} ({list.length})
                </td>
              </tr>,
              ...list.map((r) => {
                const color = categories.find((c) => c.id === r.category)?.color;
                return (
                  <tr key={r.contractDocumentId} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-2.5">
                      {r.side && (
                        <span
                          title={r.side}
                          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy px-1.5 font-caption text-[11px] font-bold text-white"
                        >
                          {abbreviations[r.side] ?? r.side.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-ink">{r.name}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={r.priority ?? ""}
                        onChange={(e) => save(r, { priority: e.target.value || null })}
                        aria-label={`Priority for ${r.name}`}
                        className={`${select} ${r.priority ? "border-border bg-bg text-ink" : "border-danger/40 bg-danger/5 text-danger"}`}
                      >
                        <option value="" disabled>
                          Priority
                        </option>
                        {PRIORITIES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={r.category ?? ""}
                        onChange={(e) =>
                          e.target.value === ADD ? addOwn(r) : save(r, { category: e.target.value || null })
                        }
                        aria-label={`Category for ${r.name}`}
                        className={`${select} ${
                          r.category && color
                            ? `${CATEGORY_COLORS[color].chip} text-ink`
                            : "border-danger/40 bg-danger/5 text-danger"
                        }`}
                      >
                        <option value="" disabled>
                          Select a category
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value={ADD}>+ Add your own&hellip;</option>
                      </select>
                    </td>
                  </tr>
                );
              }),
            ]),
          ])}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-sm text-ink-soft">
                Upload your contracts first, then come back to categorize them.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
