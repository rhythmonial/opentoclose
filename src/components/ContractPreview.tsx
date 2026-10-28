"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openPdf } from "@/lib/pdfjs";
import type { ContractBlank } from "@/lib/contractBlanks";

const KIND_LABEL: Record<ContractBlank["kind"], string> = {
  field: "Fillable field",
  underscore: "Blank (____)",
  line: "Blank line",
};

// Shows one page of a contract at a time with every blank found on it
// highlighted and numbered, next to a list of those blanks and their labels.
export function ContractPreview({
  source,
  blanks,
  pageCount,
}: {
  // The file's bytes (just picked) or a signed URL (already uploaded).
  source: ArrayBuffer | string;
  blanks: ContractBlank[];
  pageCount: number;
}) {
  const [page, setPage] = useState(() => blanks[0]?.page ?? 1);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    openPdf(source)
      .then((d) => {
        opened = d;
        if (cancelled) void d.loadingTask.destroy();
        else setDoc(d);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't open this PDF to preview it.");
      });
    return () => {
      cancelled = true;
      void opened?.loadingTask.destroy();
    };
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let task: { cancel: () => void } | null = null;
    doc.getPage(page).then((p) => {
      // Render at a fixed, sharp width and let CSS scale it to fit; the
      // container may not have its final width yet when this runs.
      const base = p.getViewport({ scale: 1 });
      const target = 1000 * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: target / base.width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      task = p.render({ canvas, viewport });
    });
    return () => task?.cancel();
  }, [doc, page]);

  const numbered = blanks.map((b, i) => ({ ...b, n: i + 1 }));
  const onPage = numbered.filter((b) => b.page === page);
  const countFor = (n: number) => blanks.filter((b) => b.page === n).length;

  return (
    <div className="flex flex-col gap-3">
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
            {countFor(n) > 0 && (
              <span className={n === page ? "text-white/80" : "text-ink-faint"}>
                {" "}
                &middot; {countFor(n)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative overflow-hidden rounded-lg border border-border bg-white">
          {error ? (
            <p className="p-6 text-sm text-danger">{error}</p>
          ) : (
            <>
              <canvas ref={canvasRef} className="block h-auto w-full" />
              {!doc && (
                <p className="p-6 text-sm text-ink-faint">Loading preview&hellip;</p>
              )}
              {doc &&
                onPage.map((b) => (
                  <div
                    key={b.n}
                    onMouseEnter={() => setActive(b.n)}
                    onMouseLeave={() => setActive(null)}
                    className={`absolute rounded-sm border-2 transition-colors ${
                      active === b.n
                        ? "border-accent bg-gold/40"
                        : "border-gold bg-gold/20"
                    }`}
                    style={{
                      left: `${b.x * 100}%`,
                      top: `${b.y * 100}%`,
                      width: `${b.width * 100}%`,
                      height: `${Math.max(b.height * 100, 1.2)}%`,
                    }}
                  >
                    <span className="absolute -left-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                      {b.n}
                    </span>
                  </div>
                ))}
            </>
          )}
        </div>

        <ol className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto">
          {onPage.length === 0 && (
            <li className="text-sm text-ink-faint">No blanks found on this page.</li>
          )}
          {onPage.map((b) => (
            <li
              key={b.n}
              onMouseEnter={() => setActive(b.n)}
              onMouseLeave={() => setActive(null)}
              className={`flex gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                active === b.n ? "border-accent bg-accent-soft" : "border-border bg-surface"
              }`}
            >
              <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {b.n}
              </span>
              <span className="min-w-0">
                <span className="block text-ink">
                  {b.label || <span className="text-ink-faint">(no label)</span>}{" "}
                  <span className="text-ink-faint">____</span>
                  {b.after && <span className="text-ink-soft"> {b.after}</span>}
                </span>
                <span className="font-caption text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                  {KIND_LABEL[b.kind]}
                  {b.fieldName && ` · ${b.fieldName}`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
