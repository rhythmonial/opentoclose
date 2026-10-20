"use client";

import { useRef, useTransition } from "react";
import { addLead } from "@/app/dashboard/leads/actions";

const inputClass =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function AddLeadDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    formRef.current?.reset();
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        title="Add a lead"
        aria-label="Add a lead"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-0 text-ink backdrop:bg-navy/40"
      >
        <form
          ref={formRef}
          action={(formData) =>
            startTransition(async () => {
              await addLead(formData);
              close();
            })
          }
          className="flex flex-col gap-3 p-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink">Add a lead</h3>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-bg"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Name</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Email</span>
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">
              Phone (optional)
            </span>
            <input name="phone" type="tel" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Notes</span>
            <textarea name="notes" rows={3} className={inputClass} />
          </label>
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink-soft"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? "Adding…" : "Add lead"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
