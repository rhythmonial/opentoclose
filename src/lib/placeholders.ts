// Placeholders for the client's fields (set in Finalize Your Fields): a
// number field whose contract says what it is when left blank starts with
// one ("134- if blank = 3"); any other field can be given one, starting
// with its contract line ("134- ").
import type { ContractBlank } from "@/lib/contractBlanks";
import { inUploadOrder } from "@/lib/docOrder";
import { isActive, otcTargetOf, placeholderText, type WorkflowField } from "@/lib/workflowFields";

type Doc = { blanks: unknown; workflow_fields: unknown; created_at: string; upload_order: number | null };

// Per field the client uses, its first box on their contracts (in their
// upload order, top to bottom): its line, and for a number, what it is
// when left blank.
export function contractLines(docs: Doc[]): Record<string, { line: number | null; ifBlank?: string }> {
  const out: Record<string, { line: number | null; ifBlank?: string }> = {};
  for (const d of inUploadOrder(docs)) {
    const blanks = (Array.isArray(d.blanks) ? d.blanks : []) as ContractBlank[];
    const fields = (Array.isArray(d.workflow_fields) ? (d.workflow_fields as WorkflowField[]) : []).filter(isActive);
    const byKey = new Map(fields.map((f) => [f.id, f] as const));
    const boxes = blanks.filter((b) => b.id && !b.removed).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    for (const b of boxes) {
      const f = byKey.get(b.group ?? b.id!);
      const target = f ? otcTargetOf(f) : undefined;
      if (!f || !target) continue;
      const at = (out[target] ??= { line: b.line ?? null });
      if (at.line === null && b.line) at.line = b.line;
      if (!at.ifBlank && f.type === "number" && f.if_blank) at.ifBlank = f.if_blank;
    }
  }
  return out;
}

export function cleanPlaceholders(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>).slice(0, 1000)) {
    if (id.length > 120 || typeof v !== "string") continue;
    out[id] = v.replace(/\s+/g, " ").slice(0, 200);
  }
  return out;
}

// A field's placeholder: the one they set ("" when they removed it), or
// for a number with an if-blank value on the contract, that.
export function placeholderOf(
  id: string,
  lines: ReturnType<typeof contractLines>,
  saved: Record<string, string>,
): string {
  if (id in saved) return saved[id].trim();
  const at = lines[id];
  return at?.ifBlank ? placeholderText(at.line, at.ifBlank) : "";
}

// Every field's placeholder that isn't empty.
export function allPlaceholders(lines: ReturnType<typeof contractLines>, saved: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const id of new Set([...Object.keys(lines), ...Object.keys(saved)])) {
    const text = placeholderOf(id, lines, saved);
    if (text) out[id] = text;
  }
  return out;
}
