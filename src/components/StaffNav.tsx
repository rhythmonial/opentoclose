"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/setup-steps", label: "Setup Steps" },
  { href: "/dashboard/stats", label: "Stats" },
];

export function StaffNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-border bg-surface px-12">
      <div className="flex items-center gap-3">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-navy">
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
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[17px] font-bold text-ink">
            OTC Setup with Josie
          </span>
          <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Staff
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {LINKS.map((link) => {
          const isActive =
            link.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${
                isActive ? "font-semibold text-ink" : "font-medium text-ink-soft"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-ink-soft sm:inline">{email}</span>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
