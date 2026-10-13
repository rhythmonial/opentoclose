const WRENCH = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const PERSON = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export function StepOwnerIcon({ completedBy }: { completedBy: string }) {
  if (completedBy === "staff") {
    return (
      <span
        title="Always staff (payment, approval, etc. — not affected by engagement type)"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-white"
      >
        {WRENCH}
      </span>
    );
  }

  if (completedBy === "setup") {
    return (
      <span
        title="Staff for Setup clients — the client does this themselves if they're DIY"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning"
      >
        {WRENCH}
      </span>
    );
  }

  if (completedBy === "diy") {
    return (
      <span
        title="DIY only — hidden from the Setup view, since staff handles the equivalent work"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-border-soft text-ink-soft"
      >
        {PERSON}
      </span>
    );
  }

  return (
    <span
      title="Completed by client — shown under both Setup and DIY"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
    >
      {PERSON}
    </span>
  );
}
