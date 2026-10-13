import Link from "next/link";

export function TopNav({
  businessName,
  active,
}: {
  businessName: string;
  active?: "setup" | "resources";
}) {
  const linkClass = (key: "setup" | "resources") =>
    `text-sm ${
      active === key ? "font-semibold text-ink" : "font-medium text-ink-soft"
    }`;

  return (
    <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-border bg-surface px-12">
      <Link href="/portal" className="flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-accent">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11l9-7 9 7" />
            <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
          </svg>
        </div>
        <span className="font-display text-[17px] font-bold text-ink">
          OTC Setup with Josie
        </span>
      </Link>

      <div className="flex items-center gap-7">
        <Link href="/portal" className={linkClass("setup")}>
          Setup
        </Link>
        <Link href="/resources" className={linkClass("resources")}>
          Resource Center
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-ink-soft sm:inline">
          {businessName}
        </span>
        <Link
          href="/profile"
          aria-label="Profile"
          title="Profile"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ink-soft"
        >
          <svg
            width="18"
            height="18"
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
        </Link>
      </div>
    </div>
  );
}
