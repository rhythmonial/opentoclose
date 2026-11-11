"use client";
import { PageCount, pageCountTitle } from "@/components/PageCount";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { setUrlParam } from "@/lib/urlState";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openPdf, drawPdfPage } from "@/lib/pdfjs";
import { fieldLabel, fieldsNeedingType, tidyGroups, type ContractBlank } from "@/lib/contractBlanks";
import { FIELD_TYPE_OPTIONS, type BoxFieldType } from "@/lib/fieldTypes";
import { isContactRole, OTC_FIELDS } from "@/lib/otcFields";
import { NEW_OTC_PREFIX } from "@/lib/workflowFields";
import { createSaveQueue } from "@/lib/saveQueue";

// Open to Close's choice fields, for naming a new choice field.
const OTC_CHOICE_FIELDS = OTC_FIELDS.filter((f) => f.kind === "choice");
// Open to Close's contact roles.
const OTC_CONTACT_ROLES = OTC_FIELDS.filter(isContactRole);

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

// The short tag shown on a typed box.
const TYPE_TAGS = Object.fromEntries(FIELD_TYPE_OPTIONS.map((t) => [t.value, t.tag])) as Record<
  BoxFieldType,
  string
>;

// A field's key: its link id, or its box's id.
const keyOf = (b: ContractBlank) => b.group ?? b.id ?? "";

// A choice option's title, from the contract's text beside it ("FHA," ->
// "FHA").
function titleFrom(b: ContractBlank) {
  const label = fieldLabel(b);
  if (label === "Unlabeled field") return "";
  const t = label.replace(/^[\s,:;.()]+|[\s,:;.()]+$/g, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

// Lets a client check every page of a contract: the blanks we found are
// highlighted, and they can add boxes (click or drag on the page), move and
// stretch them, remove wrong ones, link boxes that are one answer
// (shift+click them, then Link), choose each field's type (in the menu that
// opens at a selected box). Changes go to
// `onSave` shortly after each edit; without it, edits stay on this screen.
export function ContractReviewer({
  source,
  pageCount,
  initialBlanks,
  initialPage = 1,
  onSave,
  onFieldsLeft,
  nextDocHref,
  syncPage = false,
}: {
  // The file's bytes (just picked) or a signed URL (already uploaded).
  source: ArrayBuffer | string;
  pageCount: number;
  initialBlanks: ContractBlank[];
  // The page to open on.
  initialPage?: number;
  onSave?: (blanks: ContractBlank[]) => Promise<{ ok: boolean; error?: string }>;
  // Told how many fields in the document still need a field type.
  onFieldsLeft?: (left: number) => void;
  // The next document, for the button on the last page.
  nextDocHref?: string | null;
  // Keeps the page in the address (?page=), so a reload comes back to it.
  syncPage?: boolean;
}) {
  const [blanks, setBlanks] = useState(initialBlanks);
  const [page, setPageState] = useState(Math.min(Math.max(1, initialPage), Math.max(1, pageCount)));
  const setPage = (n: number) => {
    setPageState(n);
    if (syncPage) setUrlParam("page", n);
  };
  // Page size in points (letter until the page loads), for sizing new boxes.
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [selected, setSelected] = useState<number | null>(null);
  // How far the box's popup has been dragged (for the box it's open on).
  const [shift, setShift] = useState<{ key: number; x: number; y: number } | null>(null);
  // Boxes shift+clicked to be linked together (indexes into blanks).
  const [linking, setLinking] = useState<number[]>([]);
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  // The box under the pointer: the other boxes' tags hide so they don't
  // cover the contract around it.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // The type being hovered in the type menu, for its help.
  const [typeHelp, setTypeHelp] = useState<string | null>(null);
  // The choice field whose options are being picked (its box or link id):
  // clicking a box then makes it one of its options.
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  // The choice option (its key) being asked which choice field it's for.
  const [askChoice, setAskChoice] = useState<string | null>(null);
  // The contact (its key) being asked for its contact role.
  const [askRole, setAskRole] = useState<string | null>(null);
  // The choice field the most recently saved option went to.
  const [recentChoice, setRecentChoice] = useState<string | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

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
    // Waits for the last page to stop drawing first, so moving through
    // pages quickly can't trip over a canvas that's still busy.
    return drawPdfPage(doc, page, canvas, setPageSize);
  }, [doc, page]);

  // Save shortly after the last change (so dragging doesn't save every
  // frame), one save at a time with the latest changes.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  const saver = useRef<ReturnType<
    typeof createSaveQueue<ContractBlank[]>
  > | null>(null);
  function commit(nextBlanks: ContractBlank[]) {
    if (!onSave) return;
    saver.current ??= createSaveQueue(
      (v) =>
        onSaveRef.current
          ? onSaveRef.current(v)
          : Promise.resolve({ ok: true }),
      setSaveState,
    );
    saver.current.push(nextBlanks);
  }

  // The fields still needing a type, for the confirm button outside.
  const docLeft = fieldsNeedingType(blanks).left;
  useEffect(() => {
    onFieldsLeft?.(docLeft);
  }, [docLeft, onFieldsLeft]);

  function changeBlanks(next: ContractBlank[]) {
    const tidy = tidyGroups(next);
    setBlanks(tidy);
    commit(tidy);
  }

  // Removing a box grays it out (it's kept, to put back); removing a
  // grayed-out box deletes it for good.
  function removeSelected() {
    if (selected === null) return;
    const box = blanks[selected];
    if (box?.removed) changeBlanks(blanks.filter((_, i) => i !== selected));
    else changeBlanks(blanks.map((b, i) => (i === selected ? { ...b, removed: true } : b)));
    setSelected(null);
    setLinking([]);
  }

  function restoreSelected() {
    if (selected === null) return;
    changeBlanks(
      blanks.map((b, i) => {
        if (i !== selected) return b;
        const next = { ...b };
        delete next.removed;
        return next;
      }),
    );
  }

  // Shift+click adds a box to (or takes it out of) the ones to link,
  // starting from the box already selected.
  function toggleLinking(index: number) {
    const base = linking.length > 0 ? linking : selected !== null ? [selected] : [];
    setLinking(base.includes(index) ? base.filter((i) => i !== index) : [...base, index]);
    setSelected(null);
  }

  // Links the shift+clicked boxes, along with anything already linked to
  // them, as one answer (with the first one's type, if any has one).
  function linkSelected() {
    const joining = new Set(linking.map((i) => blanks[i]?.group).filter(Boolean));
    const group = crypto.randomUUID();
    const inLink = (b: ContractBlank, i: number) =>
      linking.includes(i) || Boolean(b.group && joining.has(b.group));
    const fieldType = [...blanks]
      .map((b, i) => ({ b, i }))
      .filter(({ b, i }) => inLink(b, i))
      .sort((a, c) => a.b.page - c.b.page || a.b.y - c.b.y || a.b.x - c.b.x)
      .find(({ b }) => b.fieldType)?.b.fieldType;
    // The first box clicked carries the link's tag.
    const lead = linking[0];
    changeBlanks(
      blanks.map((b, i) => {
        if (!inLink(b, i)) return b;
        const next: ContractBlank = { ...b, group };
        if (fieldType) next.fieldType = fieldType;
        if (i === lead) next.linkLead = true;
        else delete next.linkLead;
        return next;
      }),
    );
    setLinking([]);
  }

  // Sets the type of the selected box's field (all of its linked boxes), or
  // clears it.
  function setFieldType(index: number, fieldType: BoxFieldType | null) {
    const box = blanks[index];
    if (!box) return;
    changeBlanks(
      blanks.map((b, i) => {
        if (!(i === index || (box.group && b.group === box.group))) return b;
        const next = { ...b };
        if (fieldType) next.fieldType = fieldType;
        else delete next.fieldType;
        if (fieldType !== "choice_option") {
          delete next.choiceOf;
          delete next.optionTitle;
          delete next.optionTitles;
        }
        if (fieldType !== "choice_field") delete next.choiceOptions;
        if (fieldType !== "contact") {
          delete next.contactRole;
          delete next.contactRoleName;
        }
        return next;
      }),
    );
    setTypeHelp(null);
    // A choice field asks for its options next.
    if (fieldType === "choice_field") setOptionsFor(keyOf(box));
  }

  // Makes a box (and its linked boxes) an option of the choice field whose
  // options are being picked, titled from the contract's text beside it, or
  // takes it back out.
  function toggleOption(index: number) {
    const box = blanks[index];
    const key = box && keyOf(box);
    if (!optionsFor || !key) return;
    // Its own box goes back to it, to change its type.
    if (key === optionsFor) {
      changeChoiceType();
      return;
    }
    const isOption = box.fieldType === "choice_option" && box.choiceOf === optionsFor;
    const title = box.optionTitle ?? titleFrom(box);
    changeBlanks(
      blanks.map((b) => {
        if (keyOf(b) !== key) return b;
        const next = { ...b };
        delete next.choiceOptions;
        if (isOption) {
          delete next.fieldType;
          delete next.choiceOf;
          delete next.optionTitle;
          delete next.optionTitles;
        } else {
          next.fieldType = "choice_option";
          next.choiceOf = optionsFor;
          if (title) next.optionTitle = title;
        }
        return next;
      }),
    );
  }

  // Ties a choice option (its key) to a choice field and titles it (with
  // several titles when the one box stands for several options).
  function assignChoice(key: string, choiceOf: string, choiceName: string | null, titles: string[]) {
    const clean = titles.map((t) => t.trim().slice(0, 120)).filter(Boolean);
    changeBlanks(
      blanks.map((b) => {
        if (keyOf(b) !== key) return b;
        const next: ContractBlank = { ...b, fieldType: "choice_option", choiceOf };
        if (choiceName) next.choiceName = choiceName;
        else delete next.choiceName;
        if (clean[0]) next.optionTitle = clean[0];
        if (clean.length > 1) next.optionTitles = clean;
        else delete next.optionTitles;
        return next;
      }),
    );
    setAskChoice(null);
    setSelected(null);
  }

  // Sets a contact's role: an OTC contact role, or a new one by name (the
  // OTC role when the name matches one).
  function assignRole(key: string, role: { id: string } | { name: string }) {
    let id: string;
    let name: string | null = null;
    if ("id" in role) id = role.id;
    else {
      const match = rolesInUse
        .concat(OTC_CONTACT_ROLES.map((r) => ({ id: r.id, name: r.name })))
        .find((r) => r.name.toLowerCase() === role.name.toLowerCase());
      if (match) id = match.id;
      else {
        id = `${NEW_OTC_PREFIX}${crypto.randomUUID()}`;
        name = role.name;
      }
    }
    changeBlanks(
      blanks.map((b) => {
        if (keyOf(b) !== key) return b;
        const next: ContractBlank = { ...b, fieldType: "contact", contactRole: id };
        if (name) next.contactRoleName = name;
        else if (!id.startsWith(NEW_OTC_PREFIX)) delete next.contactRoleName;
        return next;
      }),
    );
    setAskRole(null);
    setSelected(null);
  }

  // Contact roles used on this contract (OTC's and added ones), first used
  // first.
  const rolesInUse: { id: string; name: string }[] = [];
  for (const b of blanks) {
    const id = b.fieldType === "contact" ? b.contactRole : undefined;
    if (!id || rolesInUse.some((r) => r.id === id)) continue;
    const name = b.contactRoleName ?? OTC_CONTACT_ROLES.find((r) => r.id === id)?.name;
    if (name) rolesInUse.push({ id, name });
  }
  const roleNameOf = (id?: string) => rolesInUse.find((r) => r.id === id)?.name;

  // The choice fields an option can belong to: the ones marked on the
  // contract, then ones options are already tied to (OTC's or created).
  const choiceFields = (() => {
    const out: { id: string; name: string; where?: string }[] = [];
    for (const b of blanks) {
      const key = keyOf(b);
      if (b.fieldType === "choice_field" && !out.some((c) => c.id === key)) {
        out.push({
          id: key,
          name: fieldLabel(b),
          where: b.line ? `Line ${b.line}` : `Page ${b.page}`,
        });
      }
    }
    for (const b of blanks) {
      const c = b.fieldType === "choice_option" ? b.choiceOf : undefined;
      if (!c || out.some((x) => x.id === c) || blanks.some((x) => keyOf(x) === c)) continue;
      const name = b.choiceName ?? OTC_CHOICE_FIELDS.find((f) => f.id === c)?.name;
      if (name) out.push({ id: c, name });
    }
    return out;
  })();
  const choiceNameOf = (id?: string) => choiceFields.find((c) => c.id === id)?.name;
  // The choice field the last option was saved to (the next one is likely
  // for it too), else the last one tied to an option on the contract.
  const lastChoiceOf =
    recentChoice ??
    [...blanks].reverse().find((b) => b.fieldType === "choice_option" && b.choiceOf)?.choiceOf;

  // Closes the options and opens the type menu on the choice field's box
  // (for when Choice field was the wrong type).
  function changeChoiceType() {
    const index = blanks.findIndex((b) => keyOf(b) === optionsFor);
    setOptionsFor(null);
    if (index < 0) return;
    setPage(blanks[index].page);
    setSelected(index);
  }

  // What a number is when left blank on the contract (all its boxes).
  function setIfBlank(key: string, value: string) {
    const clean = value.trim().slice(0, 20);
    changeBlanks(
      blanks.map((b) => {
        if (keyOf(b) !== key) return b;
        const next = { ...b };
        if (clean) next.ifBlank = clean;
        else delete next.ifBlank;
        return next;
      }),
    );
  }

  function setOptionTitle(key: string, title: string) {
    changeBlanks(
      blanks.map((b) => {
        if (keyOf(b) !== key) return b;
        const next = { ...b };
        if (title.trim()) next.optionTitle = title.trim().slice(0, 120);
        else delete next.optionTitle;
        // The first of several titles is the one changed.
        if (next.optionTitles?.length && next.optionTitle) {
          next.optionTitles = [next.optionTitle, ...next.optionTitles.slice(1)];
        }
        return next;
      }),
    );
  }

  // The options added by hand (not boxes on the contract).
  function setManualOptions(key: string, options: string[]) {
    changeBlanks(
      blanks.map((b) => {
        if (keyOf(b) !== key) return b;
        const next = { ...b };
        if (options.length > 0) next.choiceOptions = options;
        else delete next.choiceOptions;
        return next;
      }),
    );
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
    if (selected === null && linking.length === 0 && !optionsFor) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (selected !== null && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        setSelected(null);
        setLinking([]);
        setOptionsFor(null);
        setAskChoice(null);
        setAskRole(null);
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
    // A box added while picking a choice field's options is one of them.
    if (d.mode === "draw" && optionsFor && next[d.index]) {
      next = next.map((b, i) =>
        i === d.index ? { ...b, fieldType: "choice_option" as const, choiceOf: optionsFor } : b,
      );
      setBlanks(next);
      setSelected(null);
    }
    commit(next);
  }

  // A choice field's options: its option boxes and the ones added by hand.
  const optionCount = (key: string) =>
    new Set(blanks.filter((b) => b.fieldType === "choice_option" && b.choiceOf === key).map(keyOf))
      .size + (blanks.find((b) => keyOf(b) === key)?.choiceOptions?.length ?? 0);

  const onPage = blanks
    .map((b, index) => ({ ...b, index }))
    .filter((b) => b.page === page);
  const selectedGroup = selected !== null ? blanks[selected]?.group : undefined;
  const groupSize = (g: string) => blanks.filter((b) => b.group === g).length;
  // A link's tag (with its link icon) shows on the box clicked first when
  // linking, or else its first box in reading order.
  const tagged = new Set<string>();
  const firstOfGroup = new Set<number>();
  for (const b of onPage) {
    if (b.group && b.linkLead && !b.removed && !tagged.has(b.group)) {
      tagged.add(b.group);
      firstOfGroup.add(b.index);
    }
  }
  for (const b of [...onPage].sort((a, c) => a.y - c.y || a.x - c.x)) {
    if (!b.group || b.removed || tagged.has(b.group)) continue;
    tagged.add(b.group);
    firstOfGroup.add(b.index);
  }
  // A link is typed when any of its boxes is.
  const typedGroups = new Set(blanks.filter((b) => b.group && b.fieldType && !b.removed).map((b) => b.group!));
  const isTyped = (b: ContractBlank) => Boolean(b.fieldType || (b.group && typedGroups.has(b.group)));
  // Per page, its fields (linked boxes count once) and how many still need
  // a field type.
  const fieldsOnPage = (n: number) => fieldsNeedingType(blanks, n);

  return (
    <div ref={rootRef} className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              title={pageCountTitle(fieldsOnPage(n))}
              onClick={() => {
                setPage(n);
                setSelected(null);
                setLinking([]);
              }}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                n === page ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-soft"
              }`}
            >
              Page {n}
              <PageCount {...fieldsOnPage(n)} current={n === page} />
            </button>
          ))}
        </div>
        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <span className="text-xs text-ink-faint">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && <span className="text-danger">Couldn&rsquo;t save</span>}
          </span>
        </span>
      </div>

      <p className="text-sm text-ink-soft">
        Check that every spot someone fills in or checks on this page is
        highlighted. Missing a checkbox? Click where it is. Missing a blank
        line? Click and drag along it. Drag a box to move it, drag its ends
        to make it longer or shorter, and select a box then press{" "}
        <span className="font-semibold">&times;</span> or Delete to remove it
        (it grays out; click it to put it back). If one answer runs across
        more than one line, hold{" "}
        <span className="font-semibold">Shift</span> and click each of its
        boxes, then click Link. Click a box to choose its{" "}
        <span className="font-semibold">field type</span> (date, dollar
        amount, contact and so on) for each field your team tracks.
      </p>

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-danger bg-danger/15" />
          Needs a field type
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-gold bg-gold/25" />
          Linked, needs a field type
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-success bg-success/20" />
          Has a field type
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm border-2 border-zinc-400 bg-zinc-400/40" />
          Removed
        </span>
      </div>

      {optionsFor && (
        <ChoiceOptionsPanel
          choiceLabel={(() => {
            const first = blanks.find((b) => keyOf(b) === optionsFor);
            return first ? fieldLabel(first) : "this choice field";
          })()}
          boxOptions={blanks
            .filter((b) => b.fieldType === "choice_option" && b.choiceOf === optionsFor)
            .filter((b, i, all) => all.findIndex((c) => keyOf(c) === keyOf(b)) === i)
            .map((b) => ({ key: keyOf(b), page: b.page, title: b.optionTitle ?? "" }))}
          manualOptions={blanks.find((b) => keyOf(b) === optionsFor)?.choiceOptions ?? []}
          onTitle={setOptionTitle}
          onRemoveBox={(key) => {
            const index = blanks.findIndex((b) => keyOf(b) === key);
            if (index >= 0) toggleOption(index);
          }}
          onManual={(options) => setManualOptions(optionsFor, options)}
          onGoTo={(n) => setPage(n)}
          onDone={() => setOptionsFor(null)}
          onChangeType={changeChoiceType}
        />
      )}

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
                        if (optionsFor) {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleOption(b.index);
                          return;
                        }
                        if (e.shiftKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleLinking(b.index);
                          return;
                        }
                        setLinking([]);
                        startDrag(e, "move", b.index);
                      }}
                      onPointerEnter={() => {
                        setHoverGroup(b.group ?? null);
                        setHoverIndex(b.index);
                      }}
                      onPointerLeave={() => {
                        setHoverGroup(null);
                        setHoverIndex(null);
                      }}
                      className={`absolute rounded-sm border-2 ${optionsFor ? "cursor-pointer" : "cursor-move"} ${
                        optionsFor && keyOf(b) === optionsFor
                          ? "z-10 border-accent bg-accent/30 ring-2 ring-accent ring-offset-1"
                          : optionsFor && b.fieldType === "choice_option" && b.choiceOf === optionsFor
                            ? "z-10 border-dashed border-accent bg-accent/35"
                            : optionsFor
                              ? "border-gold/60 bg-gold/10 opacity-70 hover:bg-gold/40 hover:opacity-100"
                              : isSelected
                          ? "z-10 border-accent bg-accent/15"
                          : isLinking
                            ? "z-10 border-dashed border-accent bg-accent/25"
                            : b.removed
                              ? "border-zinc-400 bg-zinc-400/40"
                              : isTyped(b)
                                ? `border-success ${lit ? "bg-success/40" : "bg-success/20 hover:bg-success/30"}`
                                : b.group
                                  ? `border-gold ${lit ? "bg-gold/50" : "bg-gold/25 hover:bg-gold/40"}`
                                  : "border-danger bg-danger/15 hover:bg-danger/25"
                      }`}
                      style={{
                        left: `${b.x * 100}%`,
                        top: `${b.y * 100}%`,
                        width: `${b.width * 100}%`,
                        height: `${b.height * 100}%`,
                      }}
                    >
                      {!b.removed &&
                        ((b.group && firstOfGroup.has(b.index)) || (!b.group && b.fieldType)) &&
                        (hoverIndex === null ||
                          hoverIndex === b.index ||
                          Boolean(b.group && b.group === hoverGroup)) && (
                        <span
                          className={`pointer-events-none absolute -left-0.5 -top-3.5 flex items-center gap-0.5 whitespace-nowrap rounded px-1 py-px text-[9px] font-bold leading-tight ${
                            isTyped(b) ? "bg-success text-white" : "bg-gold text-ink"
                          }`}
                        >
                          {b.group && (
                            <>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                              </svg>
                              {b.fieldType && " "}
                            </>
                          )}
                          {b.fieldType === "choice_option" && choiceNameOf(b.choiceOf)
                            ? `Option: ${choiceNameOf(b.choiceOf)}`
                            : b.fieldType === "contact" && roleNameOf(b.contactRole)
                              ? `Contact: ${roleNameOf(b.contactRole)}`
                              : b.fieldType && TYPE_TAGS[b.fieldType]}
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
                  if (optionsFor) return null;
                  const anchorIndex = linking.length > 0 ? linking[linking.length - 1] : selected;
                  const anchor = anchorIndex !== null ? blanks[anchorIndex] : undefined;
                  if (!anchor || anchor.page !== page) return null;
                  // The type menu is taller than the Link one.
                  const below = anchor.y + anchor.height < (linking.length > 0 ? 0.85 : 0.55);
                  const fromRight = anchor.x > 0.55;
                  // Where it's been dragged to (for this box).
                  const moved = shift && shift.key === anchorIndex ? shift : { x: 0, y: 0 };
                  const startMove = (e: React.PointerEvent) => {
                    e.preventDefault();
                    const sx = e.clientX;
                    const sy = e.clientY;
                    const onMove = (ev: PointerEvent) =>
                      setShift({ key: anchorIndex!, x: moved.x + ev.clientX - sx, y: moved.y + ev.clientY - sy });
                    const onUp = () => {
                      window.removeEventListener("pointermove", onMove);
                      window.removeEventListener("pointerup", onUp);
                    };
                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  };
                  return (
                    <div
                      role="dialog"
                      aria-label={linking.length > 0 ? "Link boxes" : "Field type"}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        transform: `translate(${moved.x}px, ${moved.y}px)`,
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
                      ) : anchor.removed ? (
                        // A removed box: put it back, or delete it for good.
                        <span className="flex w-60 flex-col gap-2">
                          <span className="text-xs text-ink-soft">
                            This box is removed, so it isn&rsquo;t a field.
                          </span>
                          <span className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={removeSelected}
                              className="whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold text-ink-faint hover:text-danger"
                            >
                              Delete for good
                            </button>
                            <button
                              type="button"
                              onClick={restoreSelected}
                              className="whitespace-nowrap rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white"
                            >
                              Put it back
                            </button>
                          </span>
                        </span>
                      ) : (
                        askRole === keyOf(anchor) ? (
                          <ContactRolePrompt
                            key={keyOf(anchor)}
                            inUse={rolesInUse}
                            current={anchor.contactRole}
                            onPick={(id) => assignRole(keyOf(anchor), { id })}
                            onAdd={(name) => assignRole(keyOf(anchor), { name })}
                            onBack={() => setAskRole(null)}
                            onSkip={() => {
                              setAskRole(null);
                              setSelected(null);
                            }}
                          />
                        ) : askChoice === keyOf(anchor) ? (
                          <ChoiceFieldPrompt
                            // A fresh prompt for each box (its own text).
                            key={keyOf(anchor)}
                            choiceFields={choiceFields.filter((c) => c.id !== keyOf(anchor))}
                            // Its own choice field, or the one last used.
                            preselect={anchor.choiceOf ?? lastChoiceOf}
                            defaultTitles={
                              anchor.optionTitles?.length
                                ? anchor.optionTitles
                                : [anchor.optionTitle ?? titleFrom(anchor)]
                            }
                            onCreate={(choice, titles) => {
                              if ("id" in choice) {
                                // A choice field created on this contract
                                // goes with its name (OTC creates it by name).
                                assignChoice(
                                  keyOf(anchor),
                                  choice.id,
                                  choice.id.startsWith(NEW_OTC_PREFIX)
                                    ? (choiceNameOf(choice.id) ?? null)
                                    : null,
                                  titles,
                                );
                                setRecentChoice(choice.id);
                                return;
                              }
                              const otc = OTC_CHOICE_FIELDS.find(
                                (f) => f.name.toLowerCase() === choice.name.toLowerCase(),
                              );
                              const id = otc?.id ?? `${NEW_OTC_PREFIX}${crypto.randomUUID()}`;
                              assignChoice(keyOf(anchor), id, otc ? null : choice.name, titles);
                              setRecentChoice(id);
                            }}
                            onBack={() => setAskChoice(null)}
                            onDragStart={startMove}
                          />
                        ) : (
                        <>
                          {/* The field's type (its linked boxes share it). */}
                          <span
                            onPointerDown={(e) => {
                              if ((e.target as HTMLElement).closest("button")) return;
                              startMove(e);
                            }}
                            title="Drag to move"
                            className="-mx-3 -mt-2.5 flex cursor-move select-none items-baseline justify-between gap-3 rounded-t-lg px-3 pb-1 pt-2.5"
                          >
                            <span className="text-xs font-semibold text-ink">Field type</span>
                            {anchor.fieldType && (
                              <button
                                type="button"
                                onClick={() => setFieldType(anchorIndex!, null)}
                                className="text-[11px] font-semibold text-ink-faint hover:text-danger"
                              >
                                Clear
                              </button>
                            )}
                          </span>
                          <span className="grid w-[21rem] grid-cols-2 gap-1">
                            {FIELD_TYPE_OPTIONS.map((t) => {
                              const on = anchor.fieldType === t.value;
                              return (
                                <button
                                  key={t.value}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => {
                                    setFieldType(anchorIndex!, t.value);
                                    // A choice option asks for its choice
                                    // field; otherwise on to the next box.
                                    if (t.value === "choice_option") setAskChoice(keyOf(anchor));
                                    // A contact asks for its role.
                                    else if (t.value === "contact") setAskRole(keyOf(anchor));
                                    else setSelected(null);
                                  }}
                                  onPointerEnter={() => setTypeHelp(t.help)}
                                  onPointerLeave={() => setTypeHelp(null)}
                                  onFocus={() => setTypeHelp(t.help)}
                                  // Contact has a row of its own; the rest
                                  // pair up (text / text area, dollar /
                                  // percent, date / number, choice field /
                                  // option).
                                  className={`rounded-md border px-2 py-1 text-left text-xs font-medium ${
                                    t.value === "contact" ? "col-span-2" : ""
                                  } ${
                                    on
                                      ? "border-accent bg-accent text-white"
                                      : "border-border bg-surface text-ink hover:border-accent hover:bg-accent-soft/40"
                                  }`}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </span>
                          {/* Always two lines tall (wide enough for every type's help), so
                              the menu doesn't jump while hovering. */}
                          <span className="block h-[2.75rem] w-[21rem] overflow-hidden rounded-md bg-bg px-2 py-1.5 text-[11px] leading-snug text-ink-soft">
                            {typeHelp ?? "Hover over a type to see what it's for."}
                          </span>
                          {anchor.fieldType === "number" && (
                            <label className="flex w-[21rem] items-center gap-2 text-xs text-ink">
                              <span className="shrink-0 font-semibold">If left blank</span>
                              <input
                                key={keyOf(anchor)}
                                defaultValue={anchor.ifBlank ?? ""}
                                onBlur={(e) => {
                                  if (e.target.value.trim() !== (anchor.ifBlank ?? "")) {
                                    setIfBlank(keyOf(anchor), e.target.value);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                                maxLength={20}
                                placeholder="e.g. 3"
                                aria-label="What the contract says it is if left blank"
                                className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                              />
                            </label>
                          )}
                          {anchor.fieldType === "contact" && (
                            <button
                              type="button"
                              onClick={() => setAskRole(keyOf(anchor))}
                              className="flex w-[21rem] items-center justify-between gap-2 rounded-md border border-accent px-2 py-1 text-left text-xs text-accent hover:bg-accent-soft/40"
                            >
                              <span className="min-w-0 truncate">
                                {anchor.contactRole
                                  ? `Contact role: ${roleNameOf(anchor.contactRole) ?? "Unknown"}`
                                  : "No contact role yet"}
                              </span>
                              <span className="shrink-0 font-semibold">
                                {anchor.contactRole ? "Change" : "Choose"}
                              </span>
                            </button>
                          )}
                          {anchor.fieldType === "choice_field" && (
                            <button
                              type="button"
                              onClick={() => {
                                setOptionsFor(keyOf(anchor));
                                setSelected(null);
                              }}
                              className="w-[21rem] rounded-md border border-accent px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft/40"
                            >
                              Options ({optionCount(keyOf(anchor))}): select or add
                            </button>
                          )}
                          {anchor.fieldType === "choice_option" && (
                            <button
                              type="button"
                              onClick={() => setAskChoice(keyOf(anchor))}
                              className="flex w-[21rem] items-center justify-between gap-2 rounded-md border border-accent px-2 py-1 text-left text-xs text-accent hover:bg-accent-soft/40"
                            >
                              <span className="min-w-0 truncate">
                                {anchor.choiceOf
                                  ? `Option for ${choiceNameOf(anchor.choiceOf) ?? "a choice field"}${
                                      anchor.optionTitle
                                        ? `: ${(anchor.optionTitles?.length ? anchor.optionTitles : [anchor.optionTitle]).join(", ")}`
                                        : ""
                                    }`
                                  : "No choice field yet"}
                              </span>
                              <span className="shrink-0 font-semibold">
                                {anchor.choiceOf ? "Change" : "Choose"}
                              </span>
                            </button>
                          )}
                          {selectedGroup && (
                            <span className="flex items-center justify-between gap-3 border-t border-border pt-2">
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
                          )}
                        </>
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
          {onPage.filter((b) => !b.removed).length} box
          {onPage.filter((b) => !b.removed).length === 1 ? "" : "es"} on page {page}
          {" · "}
          {onPage.filter((b) => !b.removed && isTyped(b)).length} with a field type
        </span>
        {page < pageCount ? (
          <button
            type="button"
            onClick={() => {
              setPage(page + 1);
              setSelected(null);
              setLinking([]);
              // Back to the top (of the document's own page, or of the reviewer).
              if (rootRef.current?.closest("[data-contract-doc]")) window.scrollTo({ top: 0, behavior: "smooth" });
              else rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Next page &rsaquo;
          </button>
        ) : (
          nextDocHref && (
            <Link href={nextDocHref} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
              Next document &rsaquo;
            </Link>
          )
        )}
      </div>
    </div>
  );
}

// Picking a choice field's options: the checkboxes clicked on the contract
// (titled from their text, which can be changed) and ones added by hand.
function ChoiceOptionsPanel({
  choiceLabel,
  boxOptions,
  manualOptions,
  onTitle,
  onRemoveBox,
  onManual,
  onGoTo,
  onDone,
  onChangeType,
}: {
  choiceLabel: string;
  boxOptions: { key: string; page: number; title: string }[];
  manualOptions: string[];
  onTitle: (key: string, title: string) => void;
  onRemoveBox: (key: string) => void;
  onManual: (options: string[]) => void;
  onGoTo: (page: number) => void;
  onDone: () => void;
  // Back to the choice field's type menu.
  onChangeType: () => void;
}) {
  const [adding, setAdding] = useState("");
  const capitalized = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const add = () => {
    const title = capitalized(adding.trim());
    if (!title) return;
    if (![...manualOptions, ...boxOptions.map((o) => o.title)].some((t) => t.toLowerCase() === title.toLowerCase())) {
      onManual([...manualOptions, title]);
    }
    setAdding("");
  };
  const total = boxOptions.length + manualOptions.length;
  return (
    <div className="sticky top-2 z-30 rounded-xl border-2 border-accent bg-surface p-4 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Options for &ldquo;{choiceLabel}&rdquo;
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Click each checkbox on the contract that&rsquo;s one of its options (click again to
            take it out; click or drag on the page to add a missing one). Add any options that
            aren&rsquo;t on the contract below. Not a choice field? Click Change type.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onChangeType}
            title="Not a choice field? Choose another type"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-accent hover:text-accent"
          >
            Change type
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white"
          >
            Done{total > 0 ? ` (${total} option${total === 1 ? "" : "s"})` : ""}
          </button>
          <button
            type="button"
            onClick={onDone}
            aria-label="Close options"
            title="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-bg hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      </div>

      {total > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {boxOptions.map((o) => (
            <li key={o.key} className="flex items-center gap-2">
              <input
                key={o.title}
                defaultValue={o.title}
                onBlur={(e) => {
                  if (e.target.value.trim() !== o.title) onTitle(o.key, capitalized(e.target.value.trim()));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                maxLength={120}
                placeholder="Option title"
                aria-label="Option title"
                className={`w-60 rounded-md border bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-accent ${
                  o.title ? "border-border" : "border-danger/60"
                }`}
              />
              <button
                type="button"
                onClick={() => onGoTo(o.page)}
                className="text-xs text-ink-faint hover:text-accent"
              >
                On page {o.page}
              </button>
              <button
                type="button"
                onClick={() => onRemoveBox(o.key)}
                aria-label={`Remove ${o.title || "this option"}`}
                className="ml-auto text-ink-faint hover:text-danger"
              >
                &times;
              </button>
            </li>
          ))}
          {manualOptions.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="w-60 rounded-md border border-border bg-bg px-2 py-1 text-sm text-ink">{t}</span>
              <span className="text-xs text-ink-faint">Added</span>
              <button
                type="button"
                onClick={() => onManual(manualOptions.filter((x) => x !== t))}
                aria-label={`Remove ${t}`}
                className="ml-auto text-ink-faint hover:text-danger"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          maxLength={120}
          placeholder="Add an option that isn’t on the contract"
          aria-label="New option"
          className="w-72 max-w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!adding.trim()}
          className="rounded-md border border-accent px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50"
        >
          + Add option
        </button>
      </form>
    </div>
  );
}

// Asks for a choice option in two steps: first its choice field (one on
// the contract, one other options are tied to, or a new one by name, which
// is an Open to Close choice field when the name matches one), then its
// title, suggested from the contract's text beside it, to create it.
function ChoiceFieldPrompt({
  choiceFields,
  preselect,
  defaultTitles,
  onCreate,
  onBack,
  onDragStart,
}: {
  choiceFields: { id: string; name: string; where?: string }[];
  preselect?: string;
  defaultTitles: string[];
  onCreate: (choice: { id: string } | { name: string }, titles: string[]) => void;
  onBack: () => void;
  // Pressing the title row moves the popup.
  onDragStart?: (e: React.PointerEvent) => void;
}) {
  const capitalized = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  // The choice field picked: one in the list, or a new one by name.
  const [choice, setChoice] = useState<{ id: string } | { name: string } | null>(() =>
    preselect && choiceFields.some((c) => c.id === preselect) ? { id: preselect } : null,
  );
  const [adding, setAdding] = useState("");
  // The option's title, or several when this box stands for several options.
  const [titles, setTitles] = useState(() => defaultTitles.map(capitalized));
  const filled = titles.map((t) => t.trim()).filter(Boolean);
  // Opens scrolled to the choice field picked to start (usually the last
  // one, at the bottom of a long list).
  const list = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = list.current;
    const picked = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (box && picked) box.scrollTop = picked.offsetTop - box.clientHeight + picked.offsetHeight + 4;
  }, []);
  const added = choice && "name" in choice ? choice.name : null;
  // A new name that's one of Open to Close's choice fields becomes that one.
  const addedOtc = added
    ? OTC_CHOICE_FIELDS.find((f) => f.name.toLowerCase() === added.toLowerCase())
    : undefined;
  const isPicked = (id: string) => Boolean(choice && "id" in choice && choice.id === id);
  // On to the option once its choice field is chosen.
  const titleBoxes = useRef<HTMLFormElement>(null);
  const focusTitle = () =>
    requestAnimationFrame(() => {
      const inputs = titleBoxes.current?.querySelectorAll<HTMLInputElement>("input");
      const input = inputs?.[inputs.length - 1];
      input?.focus();
      input?.select();
    });
  const addNew = () => {
    const name = capitalized(adding.trim());
    if (!name) return;
    const existing = choiceFields.find((c) => c.name.toLowerCase() === name.toLowerCase());
    setChoice(existing ? { id: existing.id } : { name });
    setAdding("");
    focusTitle();
  };

  return (
    <span className="flex w-[21rem] flex-col gap-2">
      <span
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onDragStart?.(e);
        }}
        title={onDragStart ? "Drag to move" : undefined}
        className={`-mx-3 -mt-2.5 flex items-baseline justify-between gap-3 rounded-t-lg px-3 pb-1 pt-2.5 ${onDragStart ? "cursor-move select-none" : ""}`}
      >
        <span className="text-xs font-semibold text-ink">1. Which choice field is it for?</span>
        <button type="button" onClick={onBack} className="text-[11px] font-semibold text-ink-faint hover:text-ink">
          &lsaquo; Type
        </button>
      </span>
      {(choiceFields.length > 0 || added) && (
        <span ref={list} className="relative flex max-h-36 flex-col gap-1 overflow-y-auto">
          {choiceFields.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={isPicked(c.id)}
              onClick={() => {
                setChoice({ id: c.id });
                focusTitle();
              }}
              className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-xs ${
                isPicked(c.id)
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-ink hover:border-accent hover:bg-accent-soft/40"
              }`}
            >
              <span className="min-w-0 truncate font-medium">{c.name}</span>
              {c.where && (
                <span className={`shrink-0 ${isPicked(c.id) ? "text-white/80" : "text-ink-faint"}`}>
                  {c.where}
                </span>
              )}
            </button>
          ))}
          {added && (
            <span className="flex items-center justify-between gap-2 rounded-md border border-accent bg-accent px-2 py-1 text-xs text-white">
              <span className="min-w-0 truncate font-medium">{addedOtc?.name ?? added}</span>
              <span className="shrink-0 text-white/80">{addedOtc ? "OTC field" : "New"}</span>
            </span>
          )}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <input
          // Ready to type a new choice field (the last one stays picked).
          autoFocus
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNew();
            }
          }}
          list="otc-choice-fields"
          maxLength={120}
          placeholder={choiceFields.length > 0 ? "Or add a new one, e.g. Loan Type" : "Add a choice field, e.g. Loan Type"}
          aria-label="New choice field name"
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        <datalist id="otc-choice-fields">
          {OTC_CHOICE_FIELDS.map((f) => (
            <option key={f.id} value={f.name} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={addNew}
          disabled={!adding.trim()}
          className="shrink-0 rounded-md border border-accent px-2.5 py-1 text-xs font-semibold text-accent disabled:opacity-50"
        >
          Add
        </button>
      </span>

      <form
        ref={titleBoxes}
        className="flex flex-col gap-1.5 border-t border-border pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice && filled.length > 0) onCreate(choice, filled);
        }}
      >
        <span className="text-xs font-semibold text-ink">
          2. The option{titles.length > 1 ? "s" : ""}
        </span>
        {titles.map((t, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <input
              autoFocus={i === titles.length - 1 && titles.length > 1}
              value={t}
              onChange={(e) => setTitles((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                // Shift+Enter adds another option (Enter saves).
                if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  setTitles((all) => [...all, ""]);
                }
              }}
              maxLength={120}
              placeholder="Option title, e.g. FHA"
              aria-label={`Option title ${i + 1}`}
              className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
            />
            {i === titles.length - 1 ? (
              <button
                type="button"
                onClick={() => setTitles((all) => [...all, ""])}
                aria-label="Add another option for this box"
                title="Add another option for this box (Shift+Enter)"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-accent text-sm font-semibold leading-none text-accent hover:bg-accent-soft/50"
              >
                +
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setTitles((all) => all.filter((_, j) => j !== i))}
                aria-label={`Remove option ${i + 1}`}
                title="Remove this option"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm leading-none text-ink-faint hover:text-danger"
              >
                &times;
              </button>
            )}
          </span>
        ))}
        <button
          type="submit"
          disabled={!choice || filled.length === 0}
          title={!choice ? "Choose or add its choice field first" : undefined}
          className="self-end rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {filled.length > 1 ? "Save options" : "Save option"}
        </button>
      </form>
    </span>
  );
}

// Asks a contact's role: a search of Open to Close's contact roles (ones
// used on this contract first), or a new role by what was typed.
function ContactRolePrompt({
  inUse,
  current,
  onPick,
  onAdd,
  onBack,
  onSkip,
}: {
  inUse: { id: string; name: string }[];
  current?: string;
  onPick: (id: string) => void;
  onAdd: (name: string) => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const roles = [
    ...inUse,
    ...OTC_CONTACT_ROLES.filter((r) => !inUse.some((u) => u.id === r.id)).map((r) => ({
      id: r.id,
      name: r.name,
    })),
  ].filter((r) => !q || r.name.toLowerCase().includes(q));
  const exact = roles.some((r) => r.name.toLowerCase() === q);
  const typed = query.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="flex w-[21rem] flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-ink">Which contact role is this?</span>
        <button type="button" onClick={onBack} className="text-[11px] font-semibold text-ink-faint hover:text-ink">
          &lsaquo; Type
        </button>
      </span>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (roles.length === 1) onPick(roles[0].id);
          else if (typed && !exact) onAdd(typed);
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contact roles, e.g. Lender"
          aria-label="Search contact roles"
          className="w-full rounded-md border border-border bg-bg px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
      </form>
      <span className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
        {!q && inUse.length > 0 && (
          <span className="px-1 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            Used on this contract
          </span>
        )}
        {roles.map((r, i) => (
          <span key={r.id} className="contents">
            {!q && inUse.length > 0 && i === inUse.length && (
              <span className="px-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                All contact roles
              </span>
            )}
            <button
              type="button"
              onClick={() => onPick(r.id)}
              className={`rounded-md px-2 py-1 text-left text-xs ${
                r.id === current
                  ? "bg-accent font-semibold text-white"
                  : "text-ink hover:bg-accent-soft/50"
              }`}
            >
              {r.name}
            </button>
          </span>
        ))}
        {roles.length === 0 && (
          <span className="px-2 py-1 text-[11px] text-ink-faint">No contact roles match.</span>
        )}
      </span>
      {typed && !exact && (
        <button
          type="button"
          onClick={() => onAdd(typed)}
          className="rounded-md border border-dashed border-accent px-2 py-1 text-left text-xs font-semibold text-accent hover:bg-accent-soft/40"
        >
          + Add a new role: &ldquo;{typed}&rdquo;
        </button>
      )}
      {!typed && (
        <span className="text-[11px] text-ink-faint">
          Don&rsquo;t see it? Type its name to add a new role.
        </span>
      )}
      <button type="button" onClick={onSkip} className="self-start text-[11px] font-semibold text-ink-faint hover:text-ink">
        Skip for now (choose it in Assign Your Fields)
      </button>
    </span>
  );
}

