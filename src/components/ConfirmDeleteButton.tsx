"use client";

import { useEffect, useRef, useState } from "react";

const SIZES = {
  sm: { box: "h-7 min-w-7", icon: 12 },
  md: { box: "h-8 min-w-8", icon: 14 },
  lg: { box: "h-9 min-w-9", icon: 14 },
};

// A trash button for a form: the first click expands it into a red
// "Delete?" button, and a second click submits. It disarms on its own
// after a few seconds, on a click elsewhere, or with Escape.
export function ConfirmDeleteButton({
  title,
  size = "md",
}: {
  title: string;
  size?: keyof typeof SIZES;
}) {
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const armed = armedAt !== null;

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmedAt(null), 4000);
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setArmedAt(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmedAt(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [armed]);

  const { box, icon } = SIZES[size];

  return (
    <button
      ref={ref}
      type={armed ? "submit" : "button"}
      title={armed ? undefined : title}
      aria-label={armed ? `Confirm: ${title}` : title}
      onClick={(e) => {
        if (!armed) {
          // React re-renders this as type="submit" before the click's
          // default action runs, so block it or the first click submits.
          e.preventDefault();
          setArmedAt(Date.now());
        } else if (Date.now() - armedAt < 400) {
          // A double-click shouldn't arm and confirm in one go.
          e.preventDefault();
        }
      }}
      className={`inline-flex ${box} items-center justify-center rounded-lg border transition-all duration-200 ${
        armed
          ? "gap-1.5 border-danger bg-danger px-2.5 text-white"
          : "border-border text-danger"
      }`}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
      <span
        className={`overflow-hidden whitespace-nowrap text-xs font-semibold transition-all duration-200 ${
          armed ? "max-w-16 opacity-100" : "max-w-0 opacity-0"
        }`}
      >
        Delete?
      </span>
    </button>
  );
}
