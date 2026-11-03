"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openPdf } from "@/lib/pdfjs";
import { tidyGroups, type ContractBlank } from "@/lib/contractBlanks";

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
// stretch them, remove wrong ones, link boxes that are one answer
// (shift+click them, then Link), and confirm each page. Changes go to
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
  // Boxes shift+clicked to be linked together (indexes into blanks).
  const [linking, setLinking] = useState<number[]>([]);
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
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
    // Cleanup can run before the page has loaded (or twice in dev), so a
    // flag stops a late render from drawing over a newer one.
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    doc.getPage(page).then((p) => {
      if (cancelled) return;
      // Render at a fixed, sharp width and let CSS scale it to fit; the
      // container may not have its final width yet when this runs.
      const base = p.getViewport({ scale: 1 });
      const target = 1000 * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: target / base.width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ width: base.width, height: base.height });
      task = p.render({ canvas, viewport });
      // A cancelled render rejects; that's expected.
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
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
    const tidy = tidyGroups(next);
    setBlanks(tidy);
    commit(tidy, confirmed);
  }

  function removeSelected() {
    if (selected === null) return;
    changeBlanks(blanks.filter((_, i) => i !== selected));
    setSelected(null);
    setLinking([]);
  }

  // Shift+click adds a box to (or takes it out of) the ones to link,
  // starting from the box already selected.
  function toggleLinking(index: number) {
    const base = linking.length > 0 ? linking : selected !== null ? [selected] : [];
    setLinking(base.includes(index) ? base.filter((i) => i !== index) : [...base, index]);
    setSelected(null);
  }

  // Links the shift+clicked boxes, along with anything already linked to
  // them, as one answer.
  function linkSelected() {
    const joining = new Set(linking.map((i) => blanks[i]?.group).filter(Boolean));
    const group = crypto.randomUUID();
    changeBlanks(
      blanks.map((b, i) =>
        linking.includes(i) || (b.group && joining.has(b.group)) ? { ...b, group } : b,
      ),
    );
    setLinking([]);
  }

  function unlink(group: string) {
    changeBlanks(
      blanks.map((b) => {
        if (b.group !== group) return b;
        const rest = { ...b };
        delete rest.group;
        return rest;
      }),
    );
  }

  useEffect(() => {
    if (selected === null && linking.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (selected !== null && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        setSelected(null);
        setLinking([]);
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
              id: crypto.randomUUID(),
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
        setLinking([]);
        // Start the next page from its top, not where this one was confirmed.
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  const onPage = blanks
    .map((b, index) => ({ ...b, index }))
    .filter((b) => b.page === page);
  const pageConfirmed = confirmed.includes(page);
  const selectedGroup = selected !== null ? blanks[selected]?.group : undefined;
  const groupSize = (g: string) => blanks.filter((b) => b.group === g).length;
  // Each link on this page is lettered A, B, C... in reading order, and
  // the letter shows on its first box.
  const groupLetters = new Map<string, string>();
  const firstOfGroup = new Set<number>();
  for (const b of [...onPage].sort((a, c) => a.y - c.y || a.x - c.x)) {
    if (!b.group || groupLetters.has(b.group)) continue;
    groupLetters.set(b.group, String.fromCharCode(65 + (groupLetters.size % 26)));
    firstOfGroup.add(b.index);
  }

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
                setLinking([]);
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
        If one answer runs across more than one line, hold{" "}
        <span className="font-semibold">Shift</span> and click each of its
        boxes, then click Link.
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
                  setLinking([]);
                  startDrag(e, "draw", blanks.length);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute inset-0 cursor-crosshair touch-none select-none"
              >
                {onPage.map((b) => {
                  const isSelected = selected === b.index;
                  const isLinking = linking.includes(b.index);
                  const lit = b.group && (b.group === hoverGroup || b.group === selectedGroup);
                  return (
                    <div
                      key={b.index}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        if (e.shiftKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleLinking(b.index);
                          return;
                        }
                        setLinking([]);
                        startDrag(e, "move", b.index);
                      }}
                      onPointerEnter={() => setHoverGroup(b.group ?? null)}
                      onPointerLeave={() => setHoverGroup(null)}
                      className={`absolute cursor-move rounded-sm border-2 ${
                        isSelected
                          ? "z-10 border-accent bg-accent/15"
                          : isLinking
                            ? "z-10 border-dashed border-accent bg-accent/25"
                            : b.group
                              ? `border-success ${lit ? "bg-success/40" : "bg-success/20"}`
                              : "border-gold bg-gold/25 hover:bg-gold/40"
                      }`}
                      style={{
                        left: `${b.x * 100}%`,
                        top: `${b.y * 100}%`,
                        width: `${b.width * 100}%`,
                        height: `${b.height * 100}%`,
                      }}
                    >
                      {b.group && firstOfGroup.has(b.index) && (
                        <span className="pointer-events-none absolute -left-0.5 -top-3.5 flex items-center gap-0.5 whitespace-nowrap rounded bg-success px-1 py-px text-[9px] font-bold leading-tight text-white">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                          </svg>
                          {groupLetters.get(b.group)}
                        </span>
                      )}
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
                {/* Link / Unlink, right under the box last shift+clicked
                    (or the linked box that's selected). */}
                {(() => {
                  const anchorIndex = linking.length > 0 ? linking[linking.length - 1] : selectedGroup ? selected : null;
                  const anchor = anchorIndex !== null ? blanks[anchorIndex] : undefined;
                  if (!anchor || anchor.page !== page) return null;
                  const below = anchor.y + anchor.height < 0.85;
                  const fromRight = anchor.x > 0.55;
                  return (
                    <div
                      role="dialog"
                      aria-label={linking.length > 0 ? "Link boxes" : "Linked boxes"}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        ...(below
                          ? { top: `calc(${(anchor.y + anchor.height) * 100}% + 8px)` }
                          : { bottom: `calc(${(1 - anchor.y) * 100}% + 8px)` }),
                        ...(fromRight
                          ? { right: `${Math.max(0, 1 - anchor.x - anchor.width) * 100}%` }
                          : { left: `${anchor.x * 100}%` }),
                      }}
                      className="absolute z-30 flex cursor-default flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm shadow-lg"
                    >
                      {linking.length > 0 ? (
                        <>
                          <span className="whitespace-nowrap text-xs text-ink">
                            {linking.length} box{linking.length === 1 ? "" : "es"} selected
                            {linking.length < 2 && <span className="block text-ink-faint">Shift+click another box to link it</span>}
                          </span>
                          <span className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setLinking([])}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-ink-soft"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={linking.length < 2}
                              onClick={linkSelected}
                              className="whitespace-nowrap rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Link as one answer
                            </button>
                          </span>
                        </>
                      ) : (
                        selectedGroup && (
                          <span className="flex items-center gap-3">
                            <span className="whitespace-nowrap text-xs text-ink">
                              Linked with {groupSize(selectedGroup) - 1} other box
                              {groupSize(selectedGroup) === 2 ? "" : "es"}
                            </span>
                            <button
                              type="button"
                              onClick={() => unlink(selectedGroup)}
                              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft"
                            >
                              Unlink
                            </button>
                          </span>
                        )
                      )}
                    </div>
                  );
                })()}
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
