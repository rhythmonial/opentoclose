import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { REPORT_AREAS, REPORT_PARTS, type AuditReport } from "@/lib/auditReport";
import { AUDIT_FEE, AUDIT_TEXT_NUMBER, UPSELL_HOURLY_RATE } from "@/lib/audits";

// The standard PDF fonts only cover basic Latin, so curly quotes and the
// like become plain ones (anything else outside it becomes "?").
function plain(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●▪]/g, "-")
    .replace(/→/g, "->")
    .replace(/\t/g, "  ")
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "?");
}

const NAVY = rgb(0, 39 / 255, 94 / 255);
const GOLD = rgb(254 / 255, 183 / 255, 41 / 255);
const INK = rgb(13 / 255, 31 / 255, 60 / 255);
const SOFT = rgb(89 / 255, 126 / 255, 162 / 255);
const LINE = rgb(227 / 255, 230 / 255, 234 / 255);
const TINT = rgb(221 / 255, 230 / 255, 240 / 255);
const WHITE = rgb(1, 1, 1);

const W = 612;
const H = 792;
const M = 43; // 0.6in

class Writer {
  page!: PDFPage;
  y = 0;
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.newPage();
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
  let mark: PDFImage | null = null;
  if (logo) {
    try {
      mark = await doc.embedPng(logo);
    } catch {}
  }
  const w = new Writer(doc, font, bold);
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

  if (filled(report.summary)) {
    heading("Summary");
    w.text(report.summary, {});
  }
  if (filled(report.priorities)) {
    heading("Top priorities");
    w.text(report.priorities, {});
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
      w.text(report.areas[a.key][p.key], {});
      w.y -= 4;
    }
  }
  if (filled(report.next_steps)) {
    heading("Next steps");
    w.text(report.next_steps, {});
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
