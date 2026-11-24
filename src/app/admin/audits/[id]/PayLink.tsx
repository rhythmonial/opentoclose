"use client";

import { EmailDraftLink } from "@/components/EmailDraftLink";

// For a request that isn't paid: an email with its payment link (the email
// app on a phone, Gmail on a computer), with the message filled in.
export function PayLink({ link, email }: { link: string; email: string }) {
  const body = `Hi again!\n\nAs promised, here's the payment link to get started!\n\n${link}\n\nI'm looking forward to getting you going!`;
  return (
    <EmailDraftLink
      to={email}
      subject="OTC Audit Payment Link"
      body={body}
      className="mt-1 inline-block text-sm font-semibold text-accent hover:underline"
    >
      Email payment link &#8599;
    </EmailDraftLink>
  );
}
