import { statusLabel } from "@/lib/audits";

const TONES: Record<string, string> = {
  received: "bg-accent-soft text-accent",
  in_progress: "bg-gold/20 text-ink",
  delivered: "bg-success-soft text-success",
  upsold: "bg-success text-white",
  lost: "bg-border text-ink-soft",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[status] ?? TONES.lost}`}>
      {statusLabel(status)}
    </span>
  );
}
