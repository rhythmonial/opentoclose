"use client";

import { useState } from "react";

// For a request that isn't paid: its payment link to copy, and an email
// with it (opens Gmail with the message filled in).
export function PayLink({ link, email }: { link: string; email: string }) {
  const [copied, setCopied] = useState(false);
  const body = `Hi again!\n\nAs promised, here's the payment link to get started!\n\n${link}\n\nI'm looking forward to getting you going!`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(
    "OTC Audit Payment Link",
  )}&body=${encodeURIComponent(body)}`;
  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      <span className="text-xs font-semibold text-danger">Not paid yet</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
        className="text-sm font-semibold text-accent hover:underline"
      >
        {copied ? "Copied!" : "Copy payment link"}
      </button>
      <a href={gmail} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent hover:underline">
        Email payment link &#8599;
      </a>
    </div>
  );
}
