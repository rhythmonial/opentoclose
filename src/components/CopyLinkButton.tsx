"use client";

import { useState } from "react";

// Copies a link to the clipboard, saying "Copied" for a moment.
export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy this link:", link);
        }
      }}
      className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
