"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openPdf } from "@/lib/pdfjs";
import type { ContractBlank } from "@/lib/contractBlanks";

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Drag = {
  mode: "draw" | "move" | "resize";
  index: number;
  handle?: Handle;
  startX: number;
  startY: number;
  origin: ContractBlank;
  // A plain click while a box is selected only deselects it.
  hadSelection: boolean;
};

// Sizes in points: a blank line's box is as tall as the ones detection
// adds (see contractBlanks), and a click adds a checkbox this big.
const LINE_PTS = 12;
const CHECKBOX_PTS = 11;
const MIN_W = 0.01;
const MIN_H = 0.008;

const HANDLES: { id: Handle; className: string; cursor: string }[] = [
  { id: "nw", className: "-left-1.5 -top-1.5", cursor: "nwse-resize" },
  { id: "n", className: "left-1/2 -top-1.5 -translate-x-1/2", cursor: "ns-resize" },
  { id: "ne", className: "-right-1.5 -top-1.5", cursor: "nesw-resize" },
  { id: "e", className: "-right-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", className: "-right-1.5 -bottom-1.5", cursor: "nwse-resize" },
  { id: "s", className: "left-1/2 -bottom-1.5 -translate-x-1/2", cursor: "ns-resize" },
  { id: "sw", className: "-left-1.5 -bottom-1.5", cursor: "nesw-resize" },
  { id: "w", className: "-left-1.5 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

// Small boxes (checkboxes) get tiny corner handles set just outside them.
const SMALL_CORNERS: Partial<Record<Handle, string>> = {
  nw: "-left-2.5 -top-2.5",
  ne: "-right-2.5 -top-2.5",
  se: "-right-2.5 -bottom-2.5",
  sw: "-left-2.5 -bottom-2.5",
};

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

// Lets a client check every page of a contract: the blanks we found are
// highlighted, and they can add boxes (click or drag on the page), move and
// stretch them, remove wrong ones, and confirm each page. Changes go to
// `onSave` shortly after each edit; without it, edits stay on this screen.
export function ContractReviewer({
  source,
  pageCount,
  initialBlanks,
  initialConfirmed = [],
  onSave,
}: {
  // The file's bytes (just picked) or a signed URL (already uploaded).
  source: ArrayBuffer | string;
  pageCount: number;
  initialBlanks: ContractBlank[];
  initialConfirmed?: number[];
  onSave?: (blanks: ContractBlank[], confirmed: number[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [blanks, setBlanks] = useState(initialBlanks);
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [page, setPage] = useState(1);
  // Page size in points (letter until the page loads), for sizing new boxes.
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [selected, setSelected] = useState<number | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const saveTimer = useRef<number | null>(null);

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
        if (!cancelled) setLoadError("Couldn't open this PDF to review it.");
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
      setPageSize({ width: base.width, height: base.height });
      task = p.render({ canvas, viewport });
    });
    return () => task?.cancel();
  }, [doc, page]);

  // Save shortly after the last change, so dragging doesn't save every frame.
  function commit(nextBlanks: ContractBlank[], nextConfirmed: number[]) {
    if (!onSave) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = window.setTimeout(async () => {
      const result = await onSave(nextBlanks, nextConfirmed);
      setSaveState(result.ok ? "saved" : "error");
    }, 700);
  }

  function changeBlanks(next: ContractBlank[]) {
    setBlanks(next);
    commit(next, confirmed);
  }

  function removeSelected() {
    if (selected === null) return;
    changeBlanks(blanks.filter((_, i) => i !== selected));
    setSelected(null);
  }

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Pointer position as a fraction of the page.
  function point(e: React.PointerEvent) {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    };
  }

  function startDrag(e: React.PointerEvent, mode: Drag["mode"], index: number, handle?: Handle) {
    e.preventDefault();
    e.stopPropagation();
    overlayRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = point(e);
    const list =
      mode === "draw"
        ? [
            ...blanks,
            {
              page,
              kind: "manual" as const,
              type: "text" as const,
              x,
              y,
              width: 0,
              height: 0,
              label: "",
              after: "",
            },
          ]
        : blanks;
    if (mode === "draw") setBlanks(list);
    drag.current = {
      mode,
      index,
      handle,
      startX: x,
      startY: y,
      origin: list[index],
      hadSelection: selected !== null,
    };
    setSelected(index);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { x, y } = point(e);
    const dx = x - d.startX;
    const dy = y - d.startY;
    const o = d.origin;
    let box = { x: o.x, y: o.y, width: o.width, height: o.height };

    const isText = o.type !== "checkbox";
    if (d.mode === "draw") {
      // Dragging draws a blank line: only its length follows the pointer.
      const h = LINE_PTS / pageSize.height;
      box = {
        x: Math.min(d.startX, x),
        y: clamp(d.startY - h * 0.8, 0, 1 - h),
        width: Math.abs(dx),
        height: h,
      };
    } else if (d.mode === "move") {
      box.x = clamp(o.x + dx, 0, 1 - o.width);
      box.y = clamp(o.y + dy, 0, 1 - o.height);
    } else if (d.handle) {
      const right = o.x + o.width;
      const bottom = o.y + o.height;
      if (d.handle.includes("w")) {
        box.x = clamp(o.x + dx, 0, right - MIN_W);
        box.width = right - box.x;
      }
      if (d.handle.includes("e")) box.width = clamp(o.width + dx, MIN_W, 1 - o.x);
      // Blank lines only get longer or shorter, never taller.
      if (!isText && d.handle.includes("n")) {
        box.y = clamp(o.y + dy, 0, bottom - MIN_H);
        box.height = bottom - box.y;
      }
      if (!isText && d.handle.includes("s")) {
        box.height = clamp(o.height + dy, MIN_H, 1 - o.y);
      }
    }

    setBlanks((all) => all.map((b, i) => (i === d.index ? { ...b, ...box } : b)));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    let next = blanks;
    if (d.mode === "draw") {
      const drawn = blanks[d.index];
      const plainClick = drawn.width < MIN_W;
      if (plainClick && d.hadSelection) {
        setBlanks(blanks.filter((_, i) => i !== d.index));
        setSelected(null);
        return;
      }
      // A plain click adds a checkbox centered on that spot; a drag has
      // already drawn a blank line.
      if (plainClick) {
        const w = CHECKBOX_PTS / pageSize.width;
        const h = CHECKBOX_PTS / pageSize.height;
        next = blanks.map((b, i) =>
          i === d.index
            ? {
                ...b,
                type: "checkbox" as const,
                x: clamp(d.startX - w / 2, 0, 1 - w),
                y: clamp(d.startY - h / 2, 0, 1 - h),
                width: w,
                height: h,
              }
            : b,
        );
        setBlanks(next);
      }
    }
    commit(next, confirmed);
  }

  function toggleConfirmed() {
    const isConfirmed = confirmed.includes(page);
    const next = isConfirmed
      ? confirmed.filter((n) => n !== page)
      : [...confirmed, page].sort((a, b) => a - b);
    setConfirmed(next);
    commit(blanks, next);
    if (!isConfirmed) {
      // Move on to the next page still waiting for review.
      const nextPage = Array.from({ length: pageCount }, (_, i) => i + 1).find(
        (n) => n > page && !next.includes(n),
      );
      if (nextPage) {
        setPage(nextPage);
        setSelected(null);
        // Start the next page from its top, not where this one was confirmed.
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  const onPage = blanks
    .map((b, index) => ({ ...b, index }))
    .filter((b) => b.page === page);
  const pageConfirmed = confirmed.includes(page);

  return (
    <div ref={rootRef} className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPage(n);
                setSelected(null);
              }}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                n === page
                  ? "border-accent bg-accent text-white"
                  : confirmed.includes(n)
                    ? "border-success/40 bg-success-soft text-success"
                    : "border-border bg-surface text-ink-soft"
              }`}
            >
              {confirmed.includes(n) && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              Page {n}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-faint">
          {confirmed.length} of {pageCount} pages confirmed
          {saveState === "saving" && " · Saving…"}
          {saveState === "saved" && " · Saved"}
          {saveState === "error" && (
            <span className="text-danger"> · Couldn&rsquo;t save</span>
          )}
        </span>
      </div>

      <p className="text-sm text-ink-soft">
        Check that every spot someone fills in or checks on this page is
        highlighted. Missing a checkbox? Click where it is. Missing a blank
        line? Click and drag along it. Drag a box to move it, drag its ends
        to make it longer or shorter, and select a box then press{" "}
        <span className="font-semibold">&times;</span> or Delete to remove it.
      </p>

      <div className="relative overflow-hidden rounded-lg border border-border bg-white">
        {loadError ? (
          <p className="p-6 text-sm text-danger">{loadError}</p>
        ) : (
          <>
            <canvas ref={canvasRef} className="block h-auto w-full" />
            {!doc && <p className="p-6 text-sm text-ink-faint">Loading page&hellip;</p>}
            {doc && (
              <div
                ref={overlayRef}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  startDrag(e, "draw", blanks.length);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute inset-0 cursor-crosshair touch-none select-none"
              >
                {onPage.map((b) => {
                  const isSelected = selected === b.index;
                  return (
                    <div
                      key={b.index}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        startDrag(e, "move", b.index);
                      }}
                      className={`absolute cursor-move rounded-sm border-2 ${
                        isSelected
                          ? "z-10 border-accent bg-accent/15"
                          : "border-gold bg-gold/25 hover:bg-gold/40"
                      }`}
                      style={{
                        left: `${b.x * 100}%`,
                        top: `${b.y * 100}%`,
                        width: `${b.width * 100}%`,
                        height: `${b.height * 100}%`,
                      }}
                    >
                      {isSelected && (
                        <>
                          {/* Blank lines stretch from their ends only;
                              checkboxes get small corner handles. */}
                          {HANDLES.filter((h) =>
                            b.type === "checkbox" ? SMALL_CORNERS[h.id] : h.id === "e" || h.id === "w",
                          ).map((h) => (
                            <span
                              key={h.id}
                              onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                startDrag(e, "resize", b.index, h.id);
                              }}
                              style={{ cursor: h.cursor }}
                              className={`absolute rounded-sm border border-white bg-accent ${
                                b.type === "checkbox"
                                  ? `h-2 w-2 ${SMALL_CORNERS[h.id]}`
                                  : `h-3 w-3 ${h.className}`
                              }`}
                            />
                          ))}
                          <button
                            type="button"
                            aria-label="Remove this box"
                            title="Remove this box"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={removeSelected}
                            className="absolute -right-2.5 -top-7 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white shadow"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-ink-faint">
          {onPage.length} box{onPage.length === 1 ? "" : "es"} on page {page}
        </span>
        <button
          type="button"
          onClick={toggleConfirmed}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            pageConfirmed
              ? "border border-success/40 bg-success-soft text-success"
              : "bg-accent text-white"
          }`}
        >
          {pageConfirmed
            ? `Page ${page} confirmed ✓ (undo)`
            : `Confirm page ${page} looks right`}
        </button>
      </div>
    </div>
  );
}
