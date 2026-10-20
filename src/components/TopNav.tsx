import Link from "next/link";
import { stopSandbox } from "@/app/dashboard/sandbox-actions";

export function TopNav({
  businessName,
  active,
  isSandboxing,
}: {
  businessName: string;
  active?: "dashboard" | "setup" | "resources";
  isSandboxing?: boolean;
}) {
  const linkClass = (key: "dashboard" | "setup" | "resources") =>
    `text-xs sm:text-sm ${
      active === key ? "font-semibold text-ink" : "font-medium text-ink-soft"
    }`;

  return (
    <div className="flex h-[64px] shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:h-[76px] sm:px-6 lg:px-12">
      <Link href="/home" className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-accent sm:h-[34px] sm:w-[34px]">
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
        <span className="truncate font-display text-sm font-bold text-ink sm:text-[17px]">
          <span className="hidden sm:inline">OTC Setup with Josie</span>
          <span className="sm:hidden">OTC Setup</span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-3 sm:gap-7">
        <Link href="/home" className={linkClass("dashboard")}>
          Dashboard
        </Link>
        <Link href="/portal" className={linkClass("setup")}>
          Setup
        </Link>
        <Link href="/resources" className={linkClass("resources")}>
          <span className="hidden sm:inline">Resource Center</span>
          <span className="sm:hidden">Resources</span>
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <span className="hidden max-w-[140px] truncate text-sm text-ink-soft md:inline">
          {businessName}
        </span>
        <Link
          href="/profile"
          aria-label="Profile"
          title="Profile"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-ink-soft sm:h-9 sm:w-9"
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
        {isSandboxing && (
          <form action={stopSandbox}>
            <button
              type="submit"
              aria-label="Exit sandbox, return to dev dashboard"
              title="Exit sandbox, return to dev dashboard"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-danger/40 bg-danger/10 text-danger sm:h-9 sm:w-9"
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
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
