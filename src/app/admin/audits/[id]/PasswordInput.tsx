"use client";

import { useState } from "react";

const INPUT =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-sm text-ink outline-none focus:border-accent";

// The OTC password field, hidden until the eye is clicked.
export function PasswordInput({ name, initial }: { name: string; initial: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        name={name}
        type={show ? "text" : "password"}
        defaultValue={initial}
        autoComplete="off"
        className={`${INPUT} font-mono`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-faint hover:text-accent"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
          {show && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}
