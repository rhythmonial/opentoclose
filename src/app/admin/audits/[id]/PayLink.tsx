"use client";

// For a request that isn't paid: an email with its payment link (opens
// Gmail with the message filled in).
export function PayLink({ link, email }: { link: string; email: string }) {
  const body = `Hi again!\n\nAs promised, here's the payment link to get started!\n\n${link}\n\nI'm looking forward to getting you going!`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(
    "OTC Audit Payment Link",
  )}&body=${encodeURIComponent(body)}`;
  return (
    <a href={gmail} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-accent hover:underline">
      Email payment link &#8599;
    </a>
  );
}
