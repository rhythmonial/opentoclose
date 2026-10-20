import { replyToTicket, resolveTicket } from "@/app/support/actions";

export type SupportMessage = {
  id: string;
  body: string;
  created_at: string;
  fromStaff: boolean;
};

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-danger/10 text-danger" },
  answered: { label: "Answered", className: "bg-accent-soft text-accent" },
  closed: { label: "Resolved", className: "bg-border-soft text-ink-faint" },
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SupportStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.open;
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 font-caption text-[11px] font-bold uppercase tracking-wide ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export function SupportThread({
  ticketId,
  status,
  messages,
  viewerIsStaff,
  clientLabel,
}: {
  ticketId: string;
  status: string;
  messages: SupportMessage[];
  viewerIsStaff: boolean;
  clientLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = m.fromStaff === viewerIsStaff;
        const author = m.fromStaff
          ? viewerIsStaff
            ? "Our team"
            : "Josie’s team"
          : viewerIsStaff
            ? clientLabel
            : "You";

        return (
          <div
            key={m.id}
            className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${
              mine
                ? "self-end bg-accent-soft text-ink"
                : "self-start border border-border-soft bg-bg text-ink"
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-ink-faint">
              <span className="font-semibold text-ink-soft">{author}</span>
              <span>{formatWhen(m.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        );
      })}

      <form action={replyToTicket} className="flex flex-col gap-2">
        <input type="hidden" name="ticket_id" value={ticketId} />
        <textarea
          name="body"
          rows={2}
          required
          placeholder={
            status === "closed" && !viewerIsStaff
              ? "Reply to reopen this question"
              : "Write a reply"
          }
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {status !== "closed" && (
            <button
              type="submit"
              formAction={resolveTicket}
              formNoValidate
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink-soft"
            >
              Mark resolved
            </button>
          )}
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Send reply
          </button>
        </div>
      </form>
    </div>
  );
}
