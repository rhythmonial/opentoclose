"use client";

import { useState } from "react";

// Copies some text, then says so for a moment.
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      title={`Copy "${text}"`}
      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
        copied ? "border-success/40 bg-success-soft text-success" : "border-border text-ink-soft hover:border-accent hover:text-accent"
      }`}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

// Downloads rows as a CSV file.
export function DownloadCsvButton({ csv, fileName, label }: { csv: string; fileName: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
    >
      {label}
    </button>
  );
}

// A small copy icon (turns into a check for a moment once copied).
export function CopyIcon({ text, onDark = false }: { text: string; onDark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      title={copied ? "Copied" : `Copy "${text}"`}
      aria-label={`Copy ${text}`}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${
        copied
          ? onDark
            ? "text-white"
            : "text-success"
          : onDark
            ? "text-white/70 hover:text-white"
            : "text-ink-faint hover:text-accent"
      }`}
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
