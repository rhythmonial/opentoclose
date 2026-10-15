"use client";

export function ConfirmSubmitButton({
  confirmMessage,
  className,
  title,
  children,
}: {
  confirmMessage: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
