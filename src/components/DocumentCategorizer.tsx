"use client";

import { useEffect, useRef, useState } from "react";
import {
  CUSTOM_PREFIX,
  SIDES,
  sortByName,
  STARTER_CATEGORIES,
  templatePrefix,
  type DocCategory,
} from "@/lib/documentCategories";
import {
  addCategory,
  deleteCategory,
  removeDocument,
  saveDocument,
} from "@/app/configurator/categorize_your_documents/actions";

export type CategorizedDoc = {
  // A stable key for the list.
  key: string;
  // The saved row, once there is one.
  id: string | null;
  // Set for a contract uploaded in Upload Your Contracts.
  contractDocumentId: string | null;
  name: string;
  categories: string[];
  sides: string[];
};

// Categorize Your Documents: each document (the contracts they uploaded,
// plus any they add by name) gets one or more categories, sorted A to Z,
// and whether it's used on the seller, buyer and/or listing side. Clients
// can add categories of their own.
export function DocumentCategorizer({
  accountId,
  initialDocs,
  initialCustom,
}: {
  // The client account (staff only; clients use their own).
  accountId: string | null;
  initialDocs: CategorizedDoc[];
  initialCustom: DocCategory[];
}) {
  const [docs, setDocs] = useState(initialDocs);
  const [custom, setCustom] = useState(initialCustom);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [newDoc, setNewDoc] = useState("");
  const [status, setStatus] = useState<"saving" | "saved" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = sortByName([...STARTER_CATEGORIES, ...custom]);
  const byId = new Map(categories.map((c) => [c.id, c] as const));
  const done = docs.filter((d) => d.categories.length > 0 && d.sides.length > 0).length;

  async function save(doc: CategorizedDoc) {
    setStatus("saving");
    const result = await saveDocument(accountId, doc);
    if (!result.ok) {
      setStatus("error");
      setError(result.error ?? "Couldn't save.");
      return;
    }
    setStatus("saved");
    setError(null);
    if (result.id && !doc.id) {
      setDocs((all) => all.map((d) => (d.key === doc.key ? { ...d, id: result.id! } : d)));
    }
  }

  function change(key: string, update: Partial<CategorizedDoc>) {
    const doc = docs.find((d) => d.key === key);
    if (!doc) return;
    const next = { ...doc, ...update };
    setDocs((all) => all.map((d) => (d.key === key ? next : d)));
    void save(next);
  }

  async function addDoc() {
    const name = newDoc.trim();
    if (!name) return;
    const doc: CategorizedDoc = {
      key: `new-${crypto.randomUUID()}`,
      id: null,
      contractDocumentId: null,
      name,
      categories: [],
      sides: [],
    };
    setDocs((all) => [...all, doc]);
    setNewDoc("");
    await save(doc);
  }

  async function removeDoc(doc: CategorizedDoc) {
    setDocs((all) => all.filter((d) => d.key !== doc.key));
    if (doc.id) await removeDocument(accountId, doc.id);
  }

  async function createCategory(name: string) {
    const result = await addCategory(accountId, name, "gray");
    if (!result.ok || !result.id) return result.error ?? "Couldn't add that category.";
    setCustom((all) => [...all, { id: result.id!, name: name.trim(), color: "gray" }]);
    return result.id;
  }

  async function removeCategory(id: string) {
    setCustom((all) => all.filter((c) => c.id !== id));
    setDocs((all) =>
      all.map((d) => ({ ...d, categories: d.categories.filter((c) => c !== id) })),
    );
    await deleteCategory(accountId, id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addDoc();
          }}
        >
          <input
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            maxLength={160}
            placeholder="Add a document, e.g. Seller's Disclosure"
            aria-label="Document name"
            className="w-72 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!newDoc.trim()}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add document
          </button>
        </form>
        <span className="text-xs text-ink-faint">
          {done} of {docs.length} document{docs.length === 1 ? "" : "s"} categorized
          {status === "saving" && " · Saving…"}
          {status === "saved" && " · Saved"}
          {status === "error" && <span className="text-danger"> · {error}</span>}
        </span>
      </div>

      {docs.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
          No documents yet. Upload your contracts in Upload Your Contracts, or add your
          documents above by name.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {docs.map((doc) => {
          const chosen = sortByName(
            doc.categories.map((id) => byId.get(id)).filter((c): c is DocCategory => Boolean(c)),
          );
          const missing = [
            chosen.length === 0 && "a category",
            doc.sides.length === 0 && "a side",
          ].filter(Boolean);
          return (
            <li key={doc.key} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{doc.name}</p>
                  <p className="text-xs text-ink-faint">
                    {doc.contractDocumentId ? "Uploaded contract" : "Added by name"}
                    {missing.length > 0 && (
                      <span className="font-semibold text-danger">
                        {" "}
                        &middot; Needs {missing.join(" and ")}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {SIDES.map((s) => (
                    <label key={s.value} className="flex items-center gap-1.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={doc.sides.includes(s.value)}
                        onChange={(e) =>
                          change(doc.key, {
                            sides: e.target.checked
                              ? [...doc.sides, s.value]
                              : doc.sides.filter((x) => x !== s.value),
                          })
                        }
                      />
                      {s.label}
                    </label>
                  ))}
                  {!doc.contractDocumentId && (
                    <button
                      type="button"
                      onClick={() => removeDoc(doc)}
                      aria-label={`Remove ${doc.name}`}
                      title="Remove this document"
                      className="text-ink-faint hover:text-danger"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
                {chosen.map((c) => (
                  <span
                    key={c.id}
                    className="flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-0.5 text-xs font-medium text-ink"
                  >
                    {c.name}
                    <button
                      type="button"
                      aria-label={`Remove ${c.name}`}
                      onClick={() =>
                        change(doc.key, { categories: doc.categories.filter((x) => x !== c.id) })
                      }
                      className="text-ink-soft hover:text-ink"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setOpenKey(openKey === doc.key ? null : doc.key)}
                  aria-expanded={openKey === doc.key}
                  className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-accent hover:border-accent"
                >
                  + Category
                </button>
                {openKey === doc.key && (
                  <CategoryMenu
                    categories={categories}
                    selected={doc.categories}
                    onToggle={(id) =>
                      change(doc.key, {
                        categories: doc.categories.includes(id)
                          ? doc.categories.filter((x) => x !== id)
                          : [...doc.categories, id],
                      })
                    }
                    onCreate={async (name) => {
                      const id = await createCategory(name);
                      if (id.startsWith(CUSTOM_PREFIX)) {
                        change(doc.key, { categories: [...doc.categories, id] });
                        return null;
                      }
                      return id;
                    }}
                    onDelete={removeCategory}
                    onClose={() => setOpenKey(null)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <DocumentTemplates docs={docs} byId={byId} />
    </div>
  );
}

// The document templates the categories add up to: one per category and
// set of sides, named like "B/S Appraisal", with the documents in each.
function DocumentTemplates({
  docs,
  byId,
}: {
  docs: CategorizedDoc[];
  byId: Map<string, DocCategory>;
}) {
  const templates = new Map<string, { name: string; category: string; prefix: string; docs: string[] }>();
  for (const d of docs) {
    const prefix = templatePrefix(d.sides);
    if (!prefix) continue;
    for (const id of d.categories) {
      const category = byId.get(id);
      if (!category) continue;
      const name = `${prefix} ${category.name}`;
      const t = templates.get(name) ?? { name, category: category.name, prefix, docs: [] };
      t.docs.push(d.name);
      templates.set(name, t);
    }
  }
  // By category A to Z, then buyer, seller and listing.
  const order = ["B", "B/S", "B/S/L", "B/L", "S", "S/L", "L"];
  const list = [...templates.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category, undefined, { sensitivity: "base" }) ||
      order.indexOf(a.prefix) - order.indexOf(b.prefix),
  );
  const waiting = docs.filter((d) => d.categories.length === 0 || d.sides.length === 0).length;

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-ink">Your document templates</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Each category becomes a document template, named for the sides it&rsquo;s used on: B
        for buyer, S for seller and L for listing (so &ldquo;B/S Appraisal&rdquo; is used on
        buyer and seller files).
        {waiting > 0 &&
          ` ${waiting} document${waiting === 1 ? " isn't" : "s aren't"} in a template yet: ${
            waiting === 1 ? "it needs" : "they need"
          } a category and a side.`}
      </p>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">
          Nothing yet. Give a document a category and a side and its template shows up here.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((t) => (
            <li key={t.name} className="rounded-lg border border-border px-3 py-2.5">
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-ink">{t.name}</span>
                <span className="text-xs text-ink-faint">
                  {t.docs.length} document{t.docs.length === 1 ? "" : "s"}
                </span>
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
                {t.docs.map((n, i) => (
                  <li key={`${n}-${i}`} className="truncate" title={n}>
                    {n}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Picks a document's categories (A to Z, with search), adds new ones, and
// deletes the client's own.
function CategoryMenu({
  categories,
  selected,
  onToggle,
  onCreate,
  onDelete,
  onClose,
}: {
  categories: DocCategory[];
  selected: string[];
  onToggle: (id: string) => void;
  // Resolves to an error message, or null once added.
  onCreate: (name: string) => Promise<string | null>;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    ref.current?.querySelector("input")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const shown = categories.filter((c) => !q || c.name.toLowerCase().includes(q));
  const exact = categories.some((c) => c.name.toLowerCase() === q);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-30 mt-1 flex w-72 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
    >
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setError(null);
        }}
        placeholder="Search or name a new category"
        aria-label="Search categories"
        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
      />
      <div className="max-h-64 overflow-y-auto">
        {shown.map((c) => {
          const on = selected.includes(c.id);
          const isCustom = c.id.startsWith(CUSTOM_PREFIX);
          return (
            <div key={c.id} className="flex items-center gap-1">
              <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm text-ink hover:bg-accent-soft/40">
                <input type="checkbox" checked={on} onChange={() => onToggle(c.id)} />
                {c.name}
              </label>
              {isCustom &&
                (confirming === c.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null);
                      onDelete(c.id);
                    }}
                    className="rounded bg-danger px-1.5 py-0.5 text-[11px] font-semibold text-white"
                  >
                    Delete?
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete the ${c.name} category`}
                    title="Delete this category"
                    onClick={() => setConfirming(c.id)}
                    className="px-1 text-ink-faint hover:text-danger"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                ))}
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="px-1.5 py-1 text-xs text-ink-faint">No categories match.</p>
        )}
      </div>

      {q && !exact && (
        <form
          className="flex flex-col gap-2 border-t border-border pt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await onCreate(query);
            if (result) setError(result);
            else setQuery("");
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-1 text-left text-xs font-semibold text-white"
          >
            + Add category &ldquo;{query.trim()}&rdquo;
          </button>
          {error && <p className="text-xs text-danger">{error}</p>}
        </form>
      )}
    </div>
  );
}
