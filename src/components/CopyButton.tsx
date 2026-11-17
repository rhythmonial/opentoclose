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
