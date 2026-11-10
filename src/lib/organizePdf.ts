import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  fieldsToArchive,
  instructionsFor,
  ORG_SECTIONS,
  choiceChanges,
  keptOptions,
  sectionOf,
  type ChoiceEdits,
  type Layout,
  type OrgField,
} from "@/lib/fieldOrganization";

const KIND_LABELS: Record<string, string> = {
  text: "Text",
  text_area: "Text Area",
  currency: "Decimal: Dollar",
  percentage: "Decimal: Percentage",
  date: "Date",
  number: "Number",
  choice: "Choice",
};

// The standard PDF fonts only cover basic Latin, so curly quotes and the
// like become plain ones (anything else outside it becomes "?").
function plain(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const INK = rgb(0.09, 0.13, 0.24);
const SOFT = rgb(0.35, 0.4, 0.5);
const ACCENT = rgb(0.0, 0.16, 0.36);

class Writer {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page!: PDFPage;
  y = 0;
  readonly margin = 54;
  readonly width = 612;
  readonly height = 792;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - this.margin;
  }

  ensure(space: number) {
    if (this.y - space < this.margin) this.newPage();
  }

  lines(text: string, font: PDFFont, size: number, maxWidth: number) {
    const out: string[] = [];
    for (const para of plain(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
        else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  text(
    text: string,
    { size = 10.5, font = this.font, color = INK, indent = 0, gap = 4, prefix = "" } = {},
  ) {
    const x = this.margin + indent;
    const prefixWidth = prefix ? font.widthOfTextAtSize(plain(prefix) + " ", size) : 0;
    const lines = this.lines(text, font, size, this.width - this.margin - x - prefixWidth);
    const lead = size * 1.35;
    lines.forEach((line, i) => {
      this.ensure(lead);
      if (i === 0 && prefix) {
        this.page.drawText(plain(prefix), { x, y: this.y - size, size, font, color });
      }
      this.page.drawText(line, { x: x + prefixWidth, y: this.y - size, size, font, color });
      this.y -= lead;
    });
    this.y -= gap;
  }

  heading(text: string, size = 14) {
    this.ensure(size * 3);
    this.y -= 8;
    this.text(text, { size, font: this.bold, color: ACCENT, gap: 6 });
  }

  rule() {
    this.ensure(12);
    this.page.drawLine({
      start: { x: this.margin, y: this.y },
      end: { x: this.width - this.margin, y: this.y },
      thickness: 0.6,
      color: rgb(0.8, 0.83, 0.88),
    });
    this.y -= 10;
  }
}

// Step-by-step instructions for setting up the client's fields in Open to
// Close the way they organized them: archive the fields they don't use, add
// the ones they created, move sections between field groups and fields
// between sections, put sections and fields in order, then update choice
// options (and rename the fields they gave another name).
export async function organizeInstructionsPdf({
  accountName,
  layout,
  fields,
  inUse,
  names,
  choiceEdits,
  placeholders = {},
}: {
  accountName: string;
  layout: Layout;
  fields: OrgField[];
  inUse: Set<string>;
  names: Record<string, string>;
  choiceEdits: ChoiceEdits;
  // Field id -> its placeholder text ("LINE 134, if blank = 3").
  placeholders?: Record<string, string>;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Organize Your Fields - ${plain(accountName)}`);
  const w = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  );

  const steps = instructionsFor(layout, fields);
  const archive = fieldsToArchive(inUse);
  const added = fields.filter((f) => f.isNew);
  const renamed = fields.filter((f) => names[f.id]);
  const kind = (f: OrgField) => (f.kind ? ` (${KIND_LABELS[f.kind] ?? f.kind})` : "");

  w.text("Organize Your Fields", { size: 22, font: w.bold, color: ACCENT, gap: 2 });
  w.text(accountName, { size: 13, font: w.bold, gap: 2 });
  w.text(
    `Prepared ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    { size: 10, color: SOFT, gap: 10 },
  );
  w.text(
    "Work through these steps in order in Open to Close's field editor. Each step assumes the ones before it are done, so the positions line up.",
    { color: SOFT, gap: 8 },
  );
  w.rule();

  let n = 0;
  const part = (title: string) => w.heading(`${++n}. ${title}`);
  const nothing = () => w.text("Nothing to change here.", { color: SOFT, indent: 14 });

  part(`Archive the fields you don't use (${archive.reduce((a, g) => a + g.sections.reduce((b, s) => b + s.fields.length, 0), 0)})`);
  if (archive.length === 0) nothing();
  for (const g of archive) {
    w.text(g.group, { font: w.bold, indent: 14, gap: 2 });
    for (const s of g.sections) {
      w.text(s.section, { font: w.bold, size: 10, color: SOFT, indent: 28, gap: 1 });
      for (const f of s.fields) w.text(f, { indent: 42, gap: 1, prefix: "[ ]" });
      w.y -= 3;
    }
  }

  part(`Add your new fields (${added.length})`);
  if (added.length === 0) nothing();
  added.forEach((f, i) => {
    // Added before any section moves, so where OTC has the section.
    const home = ORG_SECTIONS.find((s) => s.id === sectionOf(layout, f.id));
    w.text(
      home
        ? `In ${home.group} > ${home.name}, add "${f.name}"${kind(f)}.`
        : `Add "${f.name}"${kind(f)} (no section was chosen for it in Organize Your Fields).`,
      { indent: 14, gap: 1, prefix: `${n}.${i + 1}` },
    );
    const options = f.kind === "choice" ? keptOptions(f, choiceEdits) : [];
    if (options.length) {
      w.text(`Options: ${options.join(", ")}`, { indent: 42, color: SOFT, size: 10, gap: 3 });
    }
  });

  part("Move sections to another field group");
  if (steps.sectionMoves.length === 0) nothing();
  steps.sectionMoves.forEach((m, i) =>
    w.text(`Move the "${m.section}" section from ${m.from} to ${m.to} (it goes at the end of ${m.to}).`, {
      indent: 14,
      prefix: `${n}.${i + 1}`,
    }),
  );

  part("Move fields to another section");
  if (steps.fieldMoves.length === 0) nothing();
  steps.fieldMoves.forEach((m, i) =>
    w.text(`Move "${m.field}" from the ${m.from} section to ${m.to} (it goes at the end of ${m.to}).`, {
      indent: 14,
      prefix: `${n}.${i + 1}`,
    }),
  );

  part("Put the sections in order");
  if (steps.sectionOrder.length === 0) nothing();
  let k = 0;
  for (const g of steps.sectionOrder) {
    w.text(g.group, { font: w.bold, indent: 14, gap: 2 });
    for (const s of g.steps) {
      w.text(
        s.after
          ? `Drag the "${s.section}" section to just below "${s.after}".`
          : `Drag the "${s.section}" section to the top of ${g.group}.`,
        { indent: 28, gap: 2, prefix: `${n}.${++k}` },
      );
    }
    w.y -= 3;
  }

  part("Put the fields in order");
  if (steps.fieldOrder.length === 0) nothing();
  k = 0;
  for (const s of steps.fieldOrder) {
    w.text(`${s.group} > ${s.section}`, { font: w.bold, indent: 14, gap: 2 });
    for (const f of s.steps) {
      w.text(
        f.after
          ? `Drag "${f.field}" to just below "${f.after}".`
          : `Drag "${f.field}" to the top of the section.`,
        { indent: 28, gap: 2, prefix: `${n}.${++k}` },
      );
    }
    w.y -= 3;
  }

  const changes = choiceChanges(fields, choiceEdits);
  if (changes.length > 0) {
    part(`Update choice options (${changes.length})`);
    changes.forEach((c, i) => {
      w.text(`"${c.field.name}"`, { font: w.bold, indent: 14, gap: 1, prefix: `${n}.${i + 1}` });
      if (c.remove.length) w.text(`Delete: ${c.remove.join(", ")}`, { indent: 42, gap: 1 });
      if (c.add.length) w.text(`Add: ${c.add.join(", ")}`, { indent: 42, gap: 1 });
      w.y -= 3;
    });
  }

  // Placeholder text, field by field in the order they were organized.
  const withPlaceholder = layout.flatMap((g) =>
    g.sections.flatMap((sec) =>
      sec.fields
        .filter((id) => placeholders[id])
        .map((id) => ({ group: g.group, section: sec.id, id })),
    ),
  );
  if (withPlaceholder.length > 0) {
    part(`Add placeholder text (${withPlaceholder.length})`);
    withPlaceholder.forEach((p, i) => {
      const name = fields.find((f) => f.id === p.id)?.name ?? p.id;
      w.text(`"${name}": ${placeholders[p.id]}`, { indent: 14, gap: 2, prefix: `${n}.${i + 1}` });
    });
  }

  if (renamed.length > 0) {
    part(`Rename fields (${renamed.length})`);
    renamed.forEach((f, i) =>
      w.text(`Rename "${f.name}" to "${names[f.id]}".`, { indent: 14, gap: 2, prefix: `${n}.${i + 1}` }),
    );
  }

  // Page numbers.
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: w.width - w.margin - 60,
      y: 30,
      size: 8.5,
      font: w.font,
      color: SOFT,
    }),
  );
  return doc.save();
}
