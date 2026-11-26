import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { REPORT_AREAS, REPORT_PARTS, type AuditReport } from "@/lib/auditReport";
import { AUDIT_FEE, AUDIT_TEXT_NUMBER, UPSELL_HOURLY_RATE } from "@/lib/audits";
import { fieldOrderList, fieldOrderPlan } from "@/lib/fieldMatch";
import { AUDIT_CHECKLIST, duplicateNames, withCommas, type ChecklistItem, type ChecklistValues } from "@/lib/auditChecklist";

// The standard PDF fonts only cover basic Latin, so curly quotes and the
// like become plain ones (anything else outside it becomes "?").
function plain(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[●▪]/g, "•")
    .replace(/→/g, "->")
    .replace(/\t/g, "  ")
    .replace(/[^\n\x20-\x7E\xA0-\xFF•]/g, "?");
}

const NAVY = rgb(0, 39 / 255, 94 / 255);
const GOLD = rgb(254 / 255, 183 / 255, 41 / 255);
const INK = rgb(13 / 255, 31 / 255, 60 / 255);
const SOFT = rgb(89 / 255, 126 / 255, 162 / 255);
const LINE = rgb(227 / 255, 230 / 255, 234 / 255);
const TINT = rgb(221 / 255, 230 / 255, 240 / 255);
const WHITE = rgb(1, 1, 1);

type Run = { text: string; bold?: boolean; italic?: boolean; link?: string };

// **bold**, *italic* / _italic_, `code` and [text](url) into styled runs
// (a link shows its text, then its address unless that's the text).
function inline(text: string): Run[] {
  const out: Run[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) out.push(...inline(m[2]).map((r) => ({ ...r, bold: true })));
    else if (m[4] !== undefined) out.push(...inline(m[4]).map((r) => ({ ...r, italic: true })));
    else if (m[5] !== undefined) out.push({ text: m[5] });
    else if (m[6] !== undefined) {
      out.push({ text: m[6], link: m[7] });
      if (m[6].trim() !== m[7]) out.push({ text: ` (${m[7]})` });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const W = 612;
const H = 792;
const M = 43; // 0.6in

class Writer {
  page!: PDFPage;
  y = 0;
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, italic: PDFFont, boldItalic: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.italic = italic;
    this.boldItalic = boldItalic;
    this.newPage();
  }

  // Markdown: # headings, - / * bullets and 1. numbered lists (indented
  // for nesting), **bold**, *italic*, [links](url) and blank-line
  // paragraphs.
  markdown(source: string, size = 10.5) {
    const lead = size * 1.45;
    for (const raw of plain(source).split("\n")) {
      if (!raw.trim()) {
        this.y -= lead * 0.5;
        continue;
      }
      const heading = /^\s*(#{1,3})\s+(.*)$/.exec(raw);
      if (heading) {
        const hSize = heading[1].length === 1 ? 12.5 : 11.5;
        this.y -= 3;
        this.runs(inline(heading[2]), { x: M, width: W - 2 * M, size: hSize, color: NAVY, forceBold: true });
        continue;
      }
      const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(raw);
      if (item) {
        const depth = Math.min(3, Math.floor(item[1].replace(/\t/g, "  ").length / 2));
        const x = M + 4 + depth * 14;
        const marker = /\d/.test(item[2]) ? item[2] : "•";
        const markerW = Math.max(10, this.font.widthOfTextAtSize(marker, size) + 5);
        this.ensure(lead);
        this.page.drawText(marker, { x, y: this.y - size, size, font: this.font, color: INK });
        this.runs(inline(item[3]), { x: x + markerW, width: W - M - x - markerW, size });
        continue;
      }
      this.runs(inline(raw.trim()), { x: M, width: W - 2 * M, size });
    }
  }

  // Lays out styled runs across lines, wrapping at word breaks.
  runs(
    parts: Run[],
    opts: { x: number; width: number; size: number; color?: ReturnType<typeof rgb>; forceBold?: boolean },
  ) {
    const { x, width, size } = opts;
    const lead = size * 1.45;
    const fontFor = (r: Run) =>
      (r.bold || opts.forceBold) && r.italic ? this.boldItalic : r.bold || opts.forceBold ? this.bold : r.italic ? this.italic : this.font;
    // Words, each keeping its style (and the space before it).
    const words: { text: string; run: Run; space: boolean }[] = [];
    let pendingSpace = false;
    for (const r of parts) {
      for (const token of r.text.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          pendingSpace = words.length > 0;
          continue;
        }
        words.push({ text: token, run: r, space: pendingSpace });
        pendingSpace = false;
      }
    }
    let line: typeof words = [];
    let lineW = 0;
    const flush = () => {
      this.ensure(lead);
      let cx = x;
      line.forEach((wd, i) => {
        const f = fontFor(wd.run);
        if (i > 0 && wd.space) cx += f.widthOfTextAtSize(" ", size);
        const color = wd.run.link ? NAVY : (opts.color ?? INK);
        this.page.drawText(wd.text, { x: cx, y: this.y - size, size, font: f, color });
        const ww = f.widthOfTextAtSize(wd.text, size);
        if (wd.run.link) {
          this.page.drawRectangle({ x: cx, y: this.y - size - 1.5, width: ww, height: 0.5, color: NAVY });
        }
        cx += ww;
      });
      this.y -= lead;
      line = [];
      lineW = 0;
    };
    for (const wd of words) {
      const f = fontFor(wd.run);
      const add = (line.length && wd.space ? f.widthOfTextAtSize(" ", size) : 0) + f.widthOfTextAtSize(wd.text, size);
      if (line.length && lineW + add > width) {
        flush();
        line.push({ ...wd, space: false });
        lineW = f.widthOfTextAtSize(wd.text, size);
      } else {
        line.push(wd);
        lineW += add;
      }
    }
    if (line.length) flush();
  }
  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }
  ensure(space: number) {
    if (this.y - space < M) this.newPage();
  }
  wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
    const out: string[] = [];
    for (const para of plain(text).split("\n")) {
      // Keep a list item's indent on its wrapped lines.
      const indent = /^\s*([-*]|\d+[.)])\s+/.exec(para)?.[0].replace(/\S/g, " ") ?? "";
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
        else {
          out.push(line);
          line = `${indent}${word}`;
        }
      }
      out.push(line);
    }
    return out;
  }
  text(text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; width?: number; lead?: number }) {
    const font = opts.font ?? this.font;
    const size = opts.size ?? 10.5;
    const lead = opts.lead ?? size * 1.45;
    const x = opts.x ?? M;
    for (const line of this.wrap(text, font, size, opts.width ?? W - M - x)) {
      this.ensure(lead);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lead;
    }
  }
}

export async function auditReportPdf({
  name,
  team,
  auditDate,
  delivered,
  videoLink,
  report,
  logo,
}: {
  name: string;
  team: string;
  auditDate: string;
  delivered: string;
  videoLink: string | null;
  report: AuditReport;
  // The logo mark (PNG bytes), if it could be loaded.
  logo: Uint8Array | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`OTC Audit Report - ${name} (${team})`);
  doc.setAuthor("OTC Setup with Josie");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  let mark: PDFImage | null = null;
  if (logo) {
    try {
      mark = await doc.embedPng(logo);
    } catch {}
  }
  const w = new Writer(doc, font, bold, italic, boldItalic);
  const filled = (v: string | undefined) => Boolean(v && v.trim());

  // Header: logo, site name and company on the left; title on the right.
  const top = w.y;
  let x = M;
  if (mark) {
    w.page.drawImage(mark, { x, y: top - 32, width: 32, height: 32 });
    x += 40;
  }
  w.page.drawText("OTC Setup with Josie", { x, y: top - 15, size: 14, font: bold, color: NAVY });
  w.page.drawText("Rhythmonial, LLC (formerly TC Optimize)", { x, y: top - 28, size: 8.5, font, color: SOFT });
  const title = "OTC Audit Report";
  w.page.drawText(title, { x: W - M - bold.widthOfTextAtSize(title, 19), y: top - 22, size: 19, font: bold, color: NAVY });
  w.y = top - 42;
  w.page.drawRectangle({ x: M, y: w.y, width: W - 2 * M, height: 1.6, color: NAVY });
  w.y -= 16;

  // Who it's for, the audit date and when it was delivered.
  const col = (W - 2 * M) / 3;
  const info: [string, string][] = [
    ["PREPARED FOR", `${name} (${team})`],
    ["AUDIT DATE", auditDate],
    ["DELIVERED", delivered],
  ];
  const infoTop = w.y;
  let lowest = infoTop;
  info.forEach(([label, value], i) => {
    w.y = infoTop;
    w.page.drawText(label, { x: M + i * col, y: w.y - 7, size: 7, font: bold, color: SOFT });
    w.y -= 11;
    w.text(value, { x: M + i * col, width: col - 10, size: 10 });
    lowest = Math.min(lowest, w.y);
  });
  w.y = lowest - 4;

  if (videoLink) {
    const lines = w.wrap(`Your recorded walkthrough: ${videoLink}`, font, 9.5, W - 2 * M - 16);
    const h = lines.length * 13 + 10;
    w.ensure(h);
    w.page.drawRectangle({ x: M, y: w.y - h, width: W - 2 * M, height: h, color: TINT });
    lines.forEach((line, i) => {
      w.page.drawText(line, { x: M + 8, y: w.y - 14 - i * 13, size: 9.5, font, color: NAVY });
    });
    w.y -= h + 6;
  }

  const heading = (label: string, about?: string) => {
    w.y -= 12;
    w.ensure(40);
    w.page.drawText(plain(label), { x: M, y: w.y - 14, size: 14, font: bold, color: NAVY });
    if (about) {
      w.page.drawText(plain(about), {
        x: M + bold.widthOfTextAtSize(plain(label), 14) + 8,
        y: w.y - 13,
        size: 8.5,
        font,
        color: SOFT,
      });
    }
    w.y -= 19;
    w.page.drawRectangle({ x: M, y: w.y, width: W - 2 * M, height: 0.6, color: LINE });
    w.y -= 7;
  };

  // The checklist: each step with what was found and recommended (steps
  // with nothing filled in are left out).
  checklistBlocks(w, report.checklist, heading);

  if (filled(report.summary)) {
    heading("Summary");
    w.markdown(report.summary);
  }
  if (filled(report.priorities)) {
    heading("Top priorities");
    w.markdown(report.priorities);
  }
  for (const a of REPORT_AREAS) {
    const parts = REPORT_PARTS.filter((p) => filled(report.areas[a.key]?.[p.key]));
    if (parts.length === 0) continue;
    heading(a.label, a.about);
    for (const p of parts) {
      w.ensure(30);
      w.page.drawText(p.label, { x: M, y: w.y - 10.5, size: 10.5, font: bold, color: INK });
      w.page.drawText(` - ${p.hint}`, {
        x: M + bold.widthOfTextAtSize(p.label, 10.5),
        y: w.y - 10.5,
        size: 9.5,
        font,
        color: SOFT,
      });
      w.y -= 15;
      w.markdown(report.areas[a.key][p.key]);
      w.y -= 4;
    }
  }
  if (filled(report.next_steps)) {
    heading("Next steps");
    w.markdown(report.next_steps);
  }

  // Closing: the implementation offer.
  const offer = `Implementation is $${UPSELL_HOURLY_RATE}/hour, and your $${AUDIT_FEE} audit fee is credited toward it. Reply to this email or text ${AUDIT_TEXT_NUMBER} to get started.`;
  const offerLines = w.wrap(offer, font, 10, W - 2 * M - 28);
  const boxH = 26 + offerLines.length * 14 + 10;
  w.y -= 16;
  w.ensure(boxH);
  w.page.drawRectangle({ x: M, y: w.y - boxH, width: W - 2 * M, height: boxH, color: NAVY });
  w.page.drawText("Want us to make these updates?", { x: M + 14, y: w.y - 20, size: 11, font: bold, color: GOLD });
  offerLines.forEach((line, i) => {
    w.page.drawText(line, { x: M + 14, y: w.y - 36 - i * 14, size: 10, font, color: WHITE });
  });
  w.y -= boxH;

  return doc.save();
}

type Heading = (label: string, about?: string) => void;

// What an item says in the report, or null when there's nothing to say.
type Output =
  | { kind: "line"; label: string; text: string }
  | { kind: "block"; label: string; text: string }
  | { kind: "list"; label: string; text: string; list: string[] }
  | { kind: "checklist"; label: string; options: { name: string; on: boolean }[] };

function itemOutput(item: ChecklistItem, v: ChecklistValues): Output | null {
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string).trim() : "");
  const arr = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);
  switch (item.type) {
    case "text":
    case "textarea":
      return str(item.key) ? { kind: "block", label: item.label, text: str(item.key) } : null;
    case "select":
      return str(item.key) ? { kind: "line", label: item.label, text: str(item.key) } : null;
    case "multiselect":
      return arr(item.key).length ? { kind: "line", label: item.label, text: arr(item.key).join(", ") } : null;
    case "checklist":
      return { kind: "checklist", label: item.label, options: item.options.map((o) => ({ name: o, on: arr(item.key).includes(o) })) };
    case "number": {
      const raw = str(item.key);
      if (!raw) return null;
      return { kind: "line", label: item.label, text: item.percent ? `${raw}%` : withCommas(raw) };
    }
    case "check": {
      if (v[item.key] !== true) return null;
      const d = v[`${item.key}__detail`];
      const detail = Array.isArray(d) ? d.join(", ") : typeof d === "string" ? d.trim() : "";
      const text = (item.report ?? "").replace(/\{\{detail\}\}/g, detail || "[not filled in]").trim();
      return { kind: "block", label: item.label, text: text || item.label };
    }
    case "yesno":
      return str(item.key) === "yes"
        ? { kind: "block", label: item.label, text: item.reportYes }
        : str(item.key) === "no"
          ? { kind: "block", label: item.label, text: item.reportNo }
          : null;
    case "toggle":
      return v[item.key] === true
        ? { kind: "block", label: item.label, text: item.reportOn }
        : { kind: "block", label: item.label.replace(/ is yes$/i, ""), text: item.reportOff };
    case "contract_fields": {
      // With their current fields pasted in: those fields in contract
      // order, the ones to add, and the ones not on the contract.
      if (str(`${item.key}__current`)) {
        const plan = fieldOrderPlan(str(item.key), str(`${item.key}__current`), str(`${item.key}__map`));
        const list = fieldOrderList(plan);
        if (!list.length) return null;
        let text = `${item.report}\n${list.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
        if (plan.notOnContract.length)
          text += `\n\nThese fields aren't on your contract. Move them below the ones above, or archive them if you don't use them:\n${plan.notOnContract.map((f) => `- ${f}`).join("\n")}`;
        return { kind: "block", label: "Recommended field order", text };
      }
      const lines = str(item.key)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.length
        ? { kind: "block", label: "Recommended field order", text: `${item.report}\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}` }
        : null;
    }
    case "duplicates": {
      const dups = duplicateNames(str(item.key));
      return dups.length ? { kind: "list", label: item.label.replace(/\s*\(.*\)$/, ""), text: item.report, list: dups } : null;
    }
  }
}

function checklistBlocks(w: Writer, values: ChecklistValues, heading: Heading) {
  AUDIT_CHECKLIST.forEach((step) => {
    const sections = step.sections
      .map((sec) => ({ sec, outs: sec.items.map((i) => itemOutput(i, values)).filter((o): o is Output => o !== null) }))
      // A section with only the integrations list still counts if anything's checked.
      .filter(({ outs }) => outs.some((o) => o.kind !== "checklist" || o.options.some((x) => x.on)));
    if (sections.length === 0) return;
    heading(step.title);
    for (const { sec, outs } of sections) {
      if (sec.title) {
        w.ensure(28);
        w.y -= 2;
        w.page.drawText(sec.title.toUpperCase(), { x: M, y: w.y - 9, size: 8.5, font: w.bold, color: SOFT });
        w.y -= 16;
      }
      for (const o of outs) {
        if (o.kind === "line") {
          w.runs([{ text: `${o.label}: `, bold: true }, { text: o.text }], { x: M, width: W - 2 * M, size: 10.5 });
        } else if (o.kind === "block") {
          w.ensure(30);
          w.page.drawText(plain(o.label), { x: M, y: w.y - 10.5, size: 10.5, font: w.bold, color: INK });
          w.y -= 15;
          w.markdown(o.text);
          w.y -= 4;
        } else if (o.kind === "list") {
          w.ensure(30);
          w.page.drawText(plain(o.label), { x: M, y: w.y - 10.5, size: 10.5, font: w.bold, color: INK });
          w.y -= 15;
          w.markdown(`${o.text}\n${o.list.map((x) => `- ${x}`).join("\n")}`);
          w.y -= 4;
        } else if (o.kind === "checklist") {
          w.ensure(30);
          w.page.drawText(plain(o.label), { x: M, y: w.y - 10.5, size: 10.5, font: w.bold, color: INK });
          w.y -= 17;
          // Two columns of options, a check beside the ones they use.
          const colW = (W - 2 * M) / 2;
          o.options.forEach((opt, i) => {
            if (i % 2 === 0) w.ensure(16);
            const x = M + (i % 2) * colW;
            const y = w.y - 10;
            if (opt.on) {
              // A filled box with a white check.
              w.page.drawRectangle({ x: x + 1, y: y - 0.5, width: 9, height: 9, color: NAVY });
              w.page.drawLine({ start: { x: x + 3, y: y + 4 }, end: { x: x + 5, y: y + 1.8 }, thickness: 1.4, color: WHITE });
              w.page.drawLine({ start: { x: x + 5, y: y + 1.8 }, end: { x: x + 8.4, y: y + 6.6 }, thickness: 1.4, color: WHITE });
            } else {
              w.page.drawRectangle({ x: x + 1, y: y - 0.5, width: 9, height: 9, borderColor: SOFT, borderWidth: 0.8 });
            }
            w.page.drawText(plain(opt.name), { x: x + 16, y, size: 10.5, font: opt.on ? w.bold : w.font, color: opt.on ? INK : SOFT });
            if (i % 2 === 1 || i === o.options.length - 1) w.y -= 16;
          });
          w.y -= 4;
        }
      }
    }
  });
}
