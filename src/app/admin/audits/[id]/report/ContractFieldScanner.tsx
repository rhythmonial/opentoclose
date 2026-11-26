"use client";

import { useState } from "react";
import { loadPdfjs, openPdf } from "@/lib/pdfjs";
import { analyzeContract, fieldLabel } from "@/lib/contractBlanks";

type Filled = { page: number; top: number; left: number; label: string; value: string; line: number | null };

// Field Order: upload a filled-in contract, and the blanks that have
// something written in them come back as a field list (label, what was
// filled in, and its line), to review and put in order. The contract is
// read in the browser and isn't saved.
export function ContractFieldScanner({ onList }: { onList: (lines: string[]) => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function scan(file: File) {
    setBusy(true);
    setStatus("Reading the contract…");
    try {
      const pdfjs = await loadPdfjs();
      const doc = await openPdf(await file.arrayBuffer());
      const analysis = await analyzeContract(doc, (n, total) => setStatus(`Finding blanks: page ${n} of ${total}…`));
      if (!analysis.hasText) {
        setStatus("This looks like a scan or photo (no readable text), so its blanks can't be read. Try the original PDF.");
        return;
      }
      const filled: Filled[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        setStatus(`Checking what's filled in: page ${n} of ${doc.numPages}…`);
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale: 1 });
        const vw = viewport.width;
        const vh = viewport.height;
        // Words on the page, with their place (top-left origin, points).
        const content = await page.getTextContent();
        const words = content.items.flatMap((it) => {
          if (!("str" in it) || !it.str.trim()) return [];
          const [, , , , x, y] = pdfjs.Util.transform(viewport.transform, it.transform) as number[];
          return [{ str: it.str, left: x, right: x + it.width, base: y }];
        });
        // Values typed into fillable fields.
        const annotations = (await page.getAnnotations()) as {
          subtype?: string;
          fieldName?: string;
          fieldValue?: string | string[];
          exportValue?: string;
          checkBox?: boolean;
          radioButton?: boolean;
          rect?: number[];
        }[];
        for (const b of analysis.blanks.filter((x) => x.page === n)) {
          const left = b.x * vw;
          const right = (b.x + b.width) * vw;
          const top = b.y * vh;
          const bottom = (b.y + b.height) * vh;
          let value = "";
          if (b.kind === "field") {
            const a = annotations.find(
              (x) => x.subtype === "Widget" && (b.fieldName ? x.fieldName === b.fieldName : false),
            );
            if (a) {
              const v = Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : (a.fieldValue ?? "");
              if (a.checkBox || a.radioButton) value = v && v !== "Off" && (!a.exportValue || v === a.exportValue) ? "Checked" : "";
              else value = v.trim();
            }
          } else {
            // Words written on the blank: centered over it, from a little
            // above the line to just below it (not underscores themselves).
            const on = words.filter((w) => {
              const cx = (w.left + w.right) / 2;
              return cx > left && cx < right && w.base > top - 3 && w.base < bottom + 4 && !/^[_\s.]+$/.test(w.str);
            });
            value = on.map((w) => w.str.trim()).join(" ").replace(/_+/g, "").replace(/\s+/g, " ").trim();
            if (b.type === "checkbox" && value) value = "Checked";
          }
          if (!value) continue;
          filled.push({ page: n, top, left, label: fieldLabel(b), value: value.slice(0, 80), line: b.line ?? null });
        }
        page.cleanup();
      }
      filled.sort((a, b) => a.page - b.page || a.top - b.top || a.left - b.left);
      if (filled.length === 0) {
        setStatus("No filled-in blanks found. Is this a completed contract (not a blank one)?");
        return;
      }
      onList(
        filled.map((f) => {
          // The label without the line number in front or a trailing ":" / "$".
          const label = f.label.replace(/^\d+\s+/, "").replace(/[\s:$]+$/, "") || "Unlabeled field";
          return `${label}: ${f.value}${f.line !== null ? ` (line ${f.line})` : ` (page ${f.page})`}`;
        }),
      );
      setStatus(`Found ${filled.length} filled-in field${filled.length === 1 ? "" : "s"}. Review and reorder them below.`);
    } catch (err) {
      console.error(err);
      setStatus("Couldn't read that PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label
        className={`cursor-pointer rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft/40 ${
          busy ? "pointer-events-none opacity-50" : ""
        }`}
      >
        Upload their contract (PDF)
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void scan(f);
          }}
        />
      </label>
      {status && <span className="text-xs text-ink-soft">{status}</span>}
    </div>
  );
}
