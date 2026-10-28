import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadPdfjs } from "@/lib/pdfjs";

// A fill-in spot found in a contract. Position and size are fractions of
// the page (top-left origin), so they work at any render size.
export type ContractBlank = {
  page: number;
  kind: "field" | "underscore" | "line";
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
type TextBox = Box & { str: string; size: number };
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

  // Text, positioned on the page.
  const content = await page.getTextContent();
  const text: TextBox[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str) continue;
    const [, , c, d, e, f] = item.transform as Matrix;
    const size = Math.hypot(c, d) || item.height || 10;
    const box = boxFrom(e, f, e + item.width, f + size);
    text.push({ ...box, str: item.str, size });
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

  // 2. Drawn horizontal lines (strokes, or thin filled rectangles). Vertical
  // ones are kept only to spot table grids.
  const verticals: Box[] = [];
  const operators = await page.getOperatorList();
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

  for (let i = 0; i < operators.fnArray.length; i++) {
    const fn = operators.fnArray[i];
    const args = operators.argsArray[i];
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
      for (const sub of subpaths(path)) {
        const points = sub.map(([x, y]) => {
          const px = ctm[0] * x + ctm[2] * y + ctm[4];
          const py = ctm[1] * x + ctm[3] * y + ctm[5];
          return toPage(px, py);
        });
        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        const box = {
          left: Math.min(...xs),
          right: Math.max(...xs),
          top: Math.min(...ys),
          bottom: Math.max(...ys),
        };
        const width = box.right - box.left;
        const height = box.bottom - box.top;
        if (width <= 3 && height >= 8) verticals.push(box);
        if (
          box.bottom - box.top <= 3 &&
          width >= MIN_LINE &&
          width <= viewport.width * 0.85
        ) {
          found.push({ kind: "line", ...box, top: box.bottom - 12, label: "", after: "" });
        }
      }
    }
  }

  // 3. Fillable text fields built into the PDF.
  const annotations = await page.getAnnotations();
  for (const a of annotations) {
    if (a.subtype !== "Widget" || a.fieldType !== "Tx" || a.hidden) continue;
    const [x1, y1, x2, y2] = a.rect as number[];
    found.push({
      kind: "field",
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
    const row = text.filter((t) => sameRow(t, blank));
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
    if (!blank.label && blank.kind !== "underscore") {
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
    blank.after ||= cleanAfter(after);
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
  const rank = { field: 0, underscore: 1, line: 2 } as const;
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

function cleanLabel(raw: string) {
  const text = raw.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 60 ? `…${text.slice(-59).trimStart()}` : text;
}

function cleanAfter(raw: string) {
  const text = raw.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text;
}

const round = (n: number) => Math.round(n * 10000) / 10000;
