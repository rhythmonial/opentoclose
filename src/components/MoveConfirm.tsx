"use client";

// The Move / cancel pair shown after picking a destination in a "Move ▾"
// dropdown, in place of a browser confirm. These can sit inside a
// <summary>, so clicks mustn't open or close it.
export function MoveConfirm({
  pending,
  onMove,
  onCancel,
}: {
  pending: boolean;
  onMove: () => void;
  onCancel: () => void;
}) {
  const guard = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={guard(onMove)}
        className="h-7 shrink-0 rounded-lg bg-accent px-2.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Moving…" : "Move"}
      </button>
      {!pending && (
        <button
          type="button"
          aria-label="Cancel move"
          title="Cancel"
          onClick={guard(onCancel)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-ink-faint hover:text-ink"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </>
  );
}
