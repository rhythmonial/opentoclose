import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadPdfjs } from "@/lib/pdfjs";

// A fill-in spot found in a contract. Position and size are fractions of
// the page (top-left origin), so they work at any render size.
export type ContractBlank = {
  page: number;
  // How it was found. "manual" boxes are ones the client drew while
  // reviewing.
  kind: "field" | "underscore" | "line" | "checkbox" | "manual";
  // What gets filled in: written text, or a mark in a box. Older saved
  // blanks may not have it; treat those as text.
  type?: "text" | "checkbox";
  x: number;
  y: number;
  width: number;
  height: number;
  // Text just before the blank on the same line, e.g. "Buyer(s):".
  label: string;
  // Text just after it, e.g. "(the "Property")".
  after: string;
  // Name of the fillable field, when the PDF has one.
  fieldName?: string;
};

export type ContractAnalysis = {
  pageCount: number;
  blanks: ContractBlank[];
  // False when no page has readable text (a scan or a photo).
  hasText: boolean;
};

type Box = { left: number; right: number; top: number; bottom: number };
type TextBox = Box & { str: string; size: number; symbol: boolean };
type Found = Box & Omit<ContractBlank, "page" | "x" | "y" | "width" | "height">;

type Matrix = [number, number, number, number, number, number];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const UNDERSCORES = /_{3,}|(?:_ ){3,}_?/g;
// Characters that draw an empty (or ticked) checkbox in ordinary fonts.
const BOX_CHARS = new Set([..."☐☑☒□▢❏❐❑❒◻◽⬜⬚", "\uF06F", "\uF071", "\uF0A8", "\uF0FD", "\uF0FE", "\uF078"]);
// In Wingdings and ZapfDingbats these letters are drawn as boxes.
const SYMBOL_BOX_CHARS = new Set([..."opqr¨þý"]);
const SYMBOL_FONT = /dingbat|wingding|webding/i;
const BRACKET_BOXES = /\[(?:\s{1,3}|_{1,3})\]/g;
// Checkbox size range, in points.
const BOX_MIN = 5;
const BOX_MAX = 20;
const isSquare = (b: Box) => {
  const w = b.right - b.left;
  const h = b.bottom - b.top;
  return (
    w >= BOX_MIN && w <= BOX_MAX && h >= BOX_MIN && h <= BOX_MAX &&
    Math.abs(w - h) <= Math.max(1.5, 0.25 * Math.max(w, h))
  );
};
// Lines shorter than this (in points) are usually underlines or rules in
// tables, not something to write on.
const MIN_LINE = 18;

export async function analyzeContract(
  doc: PDFDocumentProxy,
  onProgress?: (page: number, total: number) => void,
): Promise<ContractAnalysis> {
  const { OPS } = await loadPdfjs();
  const blanks: ContractBlank[] = [];
  let hasText = false;

  for (let n = 1; n <= doc.numPages; n++) {
    onProgress?.(n, doc.numPages);
    const page = await doc.getPage(n);
    const { text, found } = await analyzePage(page, OPS);
    if (text.length > 0) hasText = true;

    const viewport = page.getViewport({ scale: 1 });
    for (const blank of dedupe(found)) {
      blanks.push({
        page: n,
        kind: blank.kind,
        type: blank.type ?? "text",
        x: round(blank.left / viewport.width),
        y: round(blank.top / viewport.height),
        width: round((blank.right - blank.left) / viewport.width),
        height: round((blank.bottom - blank.top) / viewport.height),
        label: blank.label,
        after: blank.after,
        ...(blank.fieldName ? { fieldName: blank.fieldName } : {}),
      });
    }
    page.cleanup();
  }

  return { pageCount: doc.numPages, blanks, hasText };
}

async function analyzePage(
  page: PDFPageProxy,
  OPS: Record<string, number>,
): Promise<{ text: TextBox[]; found: Found[] }> {
  const viewport = page.getViewport({ scale: 1 });
  // PDF space (bottom-left origin) to page space (top-left origin).
  const toPage = (x: number, y: number) =>
    viewport.convertToViewportPoint(x, y) as [number, number];
  const boxFrom = (x1: number, y1: number, x2: number, y2: number): Box => {
    const [ax, ay] = toPage(x1, y1);
    const [bx, by] = toPage(x2, y2);
    return {
      left: Math.min(ax, bx),
      right: Math.max(ax, bx),
      top: Math.min(ay, by),
      bottom: Math.max(ay, by),
    };
  };

  // Drawing operations first: they also load the page's fonts, whose names
  // tell us when a letter is really a symbol-font checkbox.
  const operators = await page.getOperatorList();
  const fontName = (id: string) => {
    try {
      return page.commonObjs.has(id)
        ? String((page.commonObjs.get(id) as { name?: string } | null)?.name ?? "")
        : "";
    } catch {
      return "";
    }
  };

  // Text, positioned on the page.
  const content = await page.getTextContent();
  const text: TextBox[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str) continue;
    const [, , c, d, e, f] = item.transform as Matrix;
    const size = Math.hypot(c, d) || item.height || 10;
    const box = boxFrom(e, f, e + item.width, f + size);
    const family = content.styles[item.fontName]?.fontFamily ?? "";
    text.push({
      ...box,
      str: item.str,
      size,
      symbol: SYMBOL_FONT.test(`${fontName(item.fontName)} ${family}`),
    });
  }

  const found: Found[] = [];

  // 1. Runs of underscores typed into the text.
  for (const t of text) {
    if (!t.str.includes("___") && !t.str.includes("_ _ _")) continue;
    const perChar = (t.right - t.left) / t.str.length;
    const runs = [...t.str.matchAll(UNDERSCORES)];
    let previousEnd = 0;
    runs.forEach((match, i) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const nextStart = runs[i + 1]?.index ?? t.str.length;
      const left = t.left + start * perChar;
      const right = t.left + end * perChar;
      found.push({
        kind: "underscore",
        type: "text",
        left,
        right,
        top: t.bottom - t.size * 0.9,
        bottom: t.bottom + 1,
        // Text around it in the same run is its label and trailing text.
        label: cleanLabel(t.str.slice(previousEnd, start)),
        after: cleanAfter(t.str.slice(end, nextStart)),
      });
      previousEnd = end;
    });
  }

  // 1b. Checkbox characters (☐, Wingdings/ZapfDingbats boxes) and [ ].
  for (const t of text) {
    const chars = [...t.str];
    const perChar = (t.right - t.left) / chars.length;
    const side = Math.min(t.size * 0.8, Math.max(perChar, t.size * 0.6));
    const addBox = (index: number, length: number) => {
      const left = t.left + index * perChar;
      const right = Math.max(left + side, t.left + (index + length) * perChar);
      found.push({
        kind: "checkbox",
        type: "checkbox",
        left,
        right,
        top: t.bottom - side,
        bottom: t.bottom + side * 0.1,
        label: "",
        after: cleanAfter(firstOption(chars.slice(index + length).join(""))),
      });
    };
    chars.forEach((ch, i) => {
      if (BOX_CHARS.has(ch) || (t.symbol && SYMBOL_BOX_CHARS.has(ch))) addBox(i, 1);
    });
    for (const match of t.str.matchAll(BRACKET_BOXES)) {
      const start = [...t.str.slice(0, match.index ?? 0)].length;
      addBox(start, [...match[0]].length);
    }
  }

  // 2. Drawn horizontal lines (strokes, or thin filled rectangles). Vertical
  // ones are kept to spot table grids, short ones to spot drawn checkboxes.
  const verticals: Box[] = [];
  const shortH: Box[] = [];
  const shortV: Box[] = [];
  const strokes = new Set([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const paints = new Set([
    OPS.stroke,
    OPS.closeStroke,
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ]);

  // Form fields draw themselves inside begin/endAnnotation with their own
  // positioning; they're read from the annotations below instead.
  let inAnnotation = 0;
  for (let i = 0; i < operators.fnArray.length; i++) {
    const fn = operators.fnArray[i];
    const args = operators.argsArray[i];
    if (fn === OPS.beginAnnotation) {
      inAnnotation++;
      continue;
    }
    if (fn === OPS.endAnnotation) {
      inAnnotation = Math.max(0, inAnnotation - 1);
      continue;
    }
    if (inAnnotation > 0) continue;
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === OPS.transform) {
      ctm = multiply(ctm, args as Matrix);
    } else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      const matrix = args?.[0] as Matrix | null;
      if (matrix) ctm = multiply(ctm, matrix);
    } else if (fn === OPS.paintFormXObjectEnd) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === OPS.constructPath) {
      const [paint, [path]] = args as [number, [ArrayLike<number> | null]];
      if (!paints.has(paint) || !path) continue;
      const boxes = subpaths(path).map((sub) => {
        const points = sub.map(([x, y]) => {
          const px = ctm[0] * x + ctm[2] * y + ctm[4];
          const py = ctm[1] * x + ctm[3] * y + ctm[5];
          return toPage(px, py);
        });
        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        return {
          left: Math.min(...xs),
          right: Math.max(...xs),
          top: Math.min(...ys),
          bottom: Math.max(...ys),
        };
      });
      for (const box of boxes) {
        const width = box.right - box.left;
        const height = box.bottom - box.top;
        if (width <= 3 && height >= 8) verticals.push(box);
        if (height <= 1.5 && width >= BOX_MIN && width <= BOX_MAX) shortH.push(box);
        if (width <= 1.5 && height >= BOX_MIN && height <= BOX_MAX) shortV.push(box);
        // A small outlined square is a checkbox. A filled one only counts
        // when it's a frame (a square with a smaller square cut out);
        // solid ones are bullets.
        if (
          isSquare(box) &&
          (strokes.has(paint) ||
            boxes.some(
              (inner) =>
                inner !== box &&
                inner.left > box.left &&
                inner.right < box.right &&
                inner.top > box.top &&
                inner.bottom < box.bottom,
            ))
        ) {
          found.push({ kind: "checkbox", type: "checkbox", ...box, label: "", after: "" });
        }
        if (
          box.bottom - box.top <= 3 &&
          width >= MIN_LINE &&
          width <= viewport.width * 0.85
        ) {
          found.push({ kind: "line", type: "text", ...box, top: box.bottom - 12, label: "", after: "" });
        }
      }
    }
  }

  // Checkboxes drawn as four separate short lines.
  for (const top of shortH) {
    const w = top.right - top.left;
    const bottom = shortH.find(
      (b) =>
        b !== top &&
        Math.abs(b.left - top.left) <= 1.5 &&
        Math.abs(b.right - top.right) <= 1.5 &&
        b.top - top.top >= w * 0.7 &&
        b.top - top.top <= w * 1.3,
    );
    const side = bottom && shortV.find(
      (v) =>
        (Math.abs(v.left - top.left) <= 1.5 || Math.abs(v.right - top.right) <= 1.5) &&
        v.top <= top.top + 1.5 &&
        v.bottom >= bottom.bottom - 1.5,
    );
    if (bottom && side) {
      found.push({
        kind: "checkbox",
        type: "checkbox",
        left: top.left,
        right: top.right,
        top: top.top,
        bottom: bottom.bottom,
        label: "",
        after: "",
      });
    }
  }

  // 3. Fillable fields built into the PDF: text boxes, checkboxes, and
  // radio buttons.
  const annotations = await page.getAnnotations();
  for (const a of annotations) {
    if (a.subtype !== "Widget" || a.hidden) continue;
    const isText = a.fieldType === "Tx";
    const isChoice = a.fieldType === "Btn" && (a.checkBox || a.radioButton);
    if (!isText && !isChoice) continue;
    const [x1, y1, x2, y2] = a.rect as number[];
    found.push({
      kind: "field",
      type: isText ? "text" : "checkbox",
      ...boxFrom(x1, y1, x2, y2),
      label: "",
      after: "",
      fieldName: a.fieldName || undefined,
    });
  }

  // Drop lines that underline words or form a table grid rather than leave
  // room to write, then fill in labels from the text around each blank.
  const kept = found.filter(
    (blank) =>
      blank.kind !== "line" ||
      (!isUnderline(blank, text) && !isGridLine(blank, verticals)),
  );
  for (const blank of kept) {
    // Symbol-font text is checkbox glyphs, not words.
    const row = text.filter((t) => !t.symbol && sameRow(t, blank));
    // Allow some overlap: a "$" or ":" often touches the start of a line.
    const touch = (t: TextBox) => Math.max(3, t.size * 0.6);
    const before = row
      .filter((t) => t.left < blank.left && t.right <= blank.left + touch(t))
      .sort((a, b) => a.left - b.left)
      .map((t) => t.str)
      .join(" ");
    const after = row
      .filter((t) => t.right > blank.right && t.left >= blank.right - touch(t))
      .sort((a, b) => a.left - b.left)
      .map((t) => t.str)
      .join(" ");
    if (!blank.label) blank.label = cleanLabel(before);
    if (!blank.label && blank.kind !== "underscore" && blank.type !== "checkbox") {
      // Signature-style lines put their caption underneath instead.
      const caption = text
        .filter(
          (t) =>
            hasWords(t) &&
            t.top >= blank.bottom - 2 &&
            t.top - blank.bottom <= 14 &&
            Math.min(t.right, blank.right) - Math.max(t.left, blank.left) > 0,
        )
        .sort((a, b) => a.left - b.left)
        .map((t) => t.str)
        .join(" ");
      blank.label = cleanLabel(caption);
    }
    if (!blank.label) {
      // A blank that starts a wrapped line: use the end of the line above.
      const above = text.filter((t) => {
        const rise = blank.bottom - t.bottom;
        return hasWords(t) && rise >= t.size * 0.8 && rise <= t.size * 2.2;
      });
      const nearest = Math.max(...above.map((t) => t.bottom));
      blank.label = cleanLabel(
        above
          .filter((t) => Math.abs(t.bottom - nearest) <= 2)
          .sort((a, b) => a.left - b.left)
          .map((t) => t.str)
          .join(" "),
      );
    }
    // A checkbox's option name is the text right after it, up to the next box.
    blank.after ||= cleanAfter(
      blank.type === "checkbox" ? firstOption(nearestAfter(row, blank)) : after,
    );
  }

  return { text, found: kept };
}

// Splits a pdf.js path buffer (DrawOPS-encoded) into subpaths of points.
function subpaths(path: ArrayLike<number>) {
  const result: [number, number][][] = [];
  let current: [number, number][] = [];
  for (let i = 0; i < path.length; ) {
    switch (path[i++]) {
      case 0: // moveTo
        if (current.length > 1) result.push(current);
        current = [[path[i++], path[i++]]];
        break;
      case 1: // lineTo
        current.push([path[i++], path[i++]]);
        break;
      case 2: // curveTo: only the end point matters for flat lines
        i += 4;
        current.push([path[i++], path[i++]]);
        break;
      case 3: // quadraticCurveTo
        i += 2;
        current.push([path[i++], path[i++]]);
        break;
      case 4: // closePath
        break;
      default:
        return result;
    }
  }
  if (current.length > 1) result.push(current);
  return result;
}

// A line sitting right under words that span most of it is an underline.
function isUnderline(line: Box, text: TextBox[]) {
  const width = line.right - line.left;
  let covered = 0;
  for (const t of text) {
    if (!/\S/.test(t.str) || /^[_\s.]+$/.test(t.str)) continue;
    const gap = line.bottom - t.bottom;
    if (gap < -2 || gap > 5) continue;
    covered += Math.max(0, Math.min(line.right, t.right) - Math.max(line.left, t.left));
  }
  return covered > width * 0.5;
}

// A horizontal line whose end meets a vertical one is a table border.
function isGridLine(line: Box, verticals: Box[]) {
  return verticals.some(
    (v) =>
      v.top - 3 <= line.bottom &&
      v.bottom + 3 >= line.bottom &&
      [line.left, line.right].some(
        (end) => Math.abs(v.left - end) <= 3 || Math.abs(v.right - end) <= 3,
      ),
  );
}

const hasWords = (t: TextBox) => /[A-Za-z0-9]/.test(t.str);

function sameRow(t: TextBox, blank: Box) {
  const tolerance = Math.max(4, t.size * 0.6);
  return Math.abs(t.bottom - blank.bottom) <= tolerance;
}

// The same spot often shows up twice (a field drawn over a line, or
// underscores with a line under them); keep one, preferring real fields.
function dedupe(found: Found[]) {
  const rank = { field: 0, checkbox: 1, underscore: 2, line: 3, manual: 4 } as const;
  const sorted = [...found].sort((a, b) => rank[a.kind] - rank[b.kind]);
  const kept: Found[] = [];
  for (const blank of sorted) {
    const duplicate = kept.some((k) => {
      const overlap =
        Math.min(k.right, blank.right) - Math.max(k.left, blank.left);
      const narrower = Math.min(k.right - k.left, blank.right - blank.left);
      return (
        Math.abs(k.bottom - blank.bottom) <= 6 &&
        overlap > narrower * 0.5
      );
    });
    if (!duplicate) kept.push(blank);
  }
  return kept.sort((a, b) =>
    Math.abs(a.bottom - b.bottom) > 4 ? a.bottom - b.bottom : a.left - b.left,
  );
}

function nearestAfter(row: TextBox[], blank: Box) {
  const next = row
    .filter((t) => t.left >= blank.right - 2 && /\S/.test(t.str))
    .sort((a, b) => a.left - b.left)[0];
  return next?.str ?? "";
}

// The text up to the next checkbox, e.g. "Cash" from "Cash ☐ FHA".
function firstOption(raw: string) {
  const stop = [...raw].findIndex((ch) => BOX_CHARS.has(ch) || ch === "[");
  return stop >= 0 ? [...raw].slice(0, stop).join("") : raw;
}

const stripBoxes = (raw: string) =>
  [...raw.replace(BRACKET_BOXES, " ")].map((ch) => (BOX_CHARS.has(ch) ? " " : ch)).join("");

function cleanLabel(raw: string) {
  const text = stripBoxes(raw).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 60 ? `…${text.slice(-59).trimStart()}` : text;
}

function cleanAfter(raw: string) {
  const text = stripBoxes(raw).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text;
}

const round = (n: number) => Math.round(n * 10000) / 10000;
