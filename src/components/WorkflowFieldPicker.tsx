"use client";

import { useRef, useState } from "react";
import type { ContractBlank } from "@/lib/contractBlanks";
import { PdfPageCanvas, usePdfDocument } from "@/components/PdfPageCanvas";

// Shows a contract page by page with every field from the review outlined;
// clicking a field adds it to (or removes it from) the fields the
// transaction workflow tracks. Picks go to `onSave` shortly after each
// click; without it, they stay on this screen.
export function WorkflowFieldPicker({
  source,
  pageCount,
  blanks,
  initialSelected,
  onSave,
}: {
  source: ArrayBuffer | string;
  pageCount: number;
  blanks: ContractBlank[];
  initialSelected: string[];
  onSave?: (ids: string[]) => Promise<{ ok: boolean }>;
}) {
  const { doc, error } = usePdfDocument(source);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const timer = useRef<number | null>(null);

  const fields = blanks.filter((b): b is ContractBlank & { id: string } => Boolean(b.id));
  const onPage = fields.filter((b) => b.page === page);
  const countOn = (n: number) => fields.filter((b) => b.page === n && selected.has(b.id)).length;

  function update(next: Set<string>) {
    setSelected(next);
    if (!onSave) return;
    if (timer.current) window.clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = window.setTimeout(async () => {
      const result = await onSave([...next]);
      setSaveState(result.ok ? "saved" : "error");
    }, 600);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  }

  function setPageAll(on: boolean) {
    const next = new Set(selected);
    for (const b of onPage) {
      if (on) next.add(b.id);
      else next.delete(b.id);
    }
    update(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                n === page
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-ink-soft"
              }`}
            >
              Page {n}
              {countOn(n) > 0 && (
                <span className={n === page ? "text-white/80" : "text-accent"}>
                  {" "}
                  &middot; {countOn(n)}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-faint">
          {selected.size} workflow field{selected.size === 1 ? "" : "s"} picked
          {saveState === "saving" && " · Saving…"}
          {saveState === "saved" && " · Saved"}
          {saveState === "error" && <span className="text-danger"> · Couldn&rsquo;t save</span>}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          Click each field your team needs to track during a transaction. Click
          it again to take it back out.
        </p>
        <div className="flex gap-3 text-xs font-semibold">
          <button type="button" onClick={() => setPageAll(true)} className="text-accent">
            Pick all on this page
          </button>
          <button type="button" onClick={() => setPageAll(false)} className="text-ink-soft">
            Clear this page
          </button>
        </div>
      </div>

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
                const isPicked = selected.has(b.id);
                // A checkbox is named by its option (after it); a blank by
                // the text before it.
                const label =
                  (b.type === "checkbox" ? b.after || b.label : b.label || b.after) ||
                  "Unlabeled field";
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggle(b.id)}
                    aria-pressed={isPicked}
                    aria-label={`${isPicked ? "Remove" : "Pick"} ${label}`}
                    title={label}
                    className={`absolute flex items-center justify-center rounded-sm border-2 transition-colors ${
                      isPicked
                        ? "border-accent bg-accent/30"
                        : "border-gold/70 bg-gold/10 hover:bg-gold/30"
                    }`}
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.width * 100}%`,
                      height: `${b.height * 100}%`,
                    }}
                  >
                    {isPicked && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-[70%] max-h-3.5 text-accent"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-gold/70 bg-gold/10" />
          Contract field
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-accent bg-accent/30" />
          Workflow field
        </span>
      </div>
    </div>
  );
}
