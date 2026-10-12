"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard#clients", label: "Clients" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/stats", label: "Stats" },
];

export function StaffNav() {
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
        <span className="font-display text-[17px] font-bold text-ink">
          OTC Setup with Josie
        </span>
      </div>

      <div className="flex items-center gap-6">
        {LINKS.map((link) => {
          const isAnchor = link.href.includes("#");
          const isActive = !isAnchor && pathname === link.href;
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

      <div className="flex items-center gap-3">
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
