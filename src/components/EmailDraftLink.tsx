"use client";

// A link that drafts an email: on a phone it's a mailto: link, which opens
// the email app (Gmail, when it's the phone's default); on a computer it
// opens a Gmail draft in a new tab (mailto: there needs a desktop email app
// set as the default).
export function EmailDraftLink({
  to,
  subject,
  body,
  className,
  children,
}: {
  to: string;
  subject: string;
  body: string;
  className?: string;
  children: React.ReactNode;
}) {
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <a
      href={gmail}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
          e.preventDefault();
          window.location.href = mailto;
        }
      }}
      className={className}
    >
      {children}
    </a>
  );
}
