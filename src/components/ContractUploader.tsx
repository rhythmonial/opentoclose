"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { openPdf } from "@/lib/pdfjs";
import { analyzeContract, type ContractAnalysis } from "@/lib/contractBlanks";
import { saveContractDocument } from "@/app/configurator/upload_your_contract_docs/actions";
import { ContractReviewer } from "@/components/ContractReviewer";

const MAX_BYTES = 25 * 1024 * 1024;

type Item = {
  id: string;
  file: File;
  status: "queued" | "reading" | "uploading" | "done" | "error";
  progress?: string;
  error?: string;
  analysis?: ContractAnalysis;
  bytes?: ArrayBuffer;
};

// Lets a client pick or drop contract PDFs: a button beside the lesson's
// title (files can be dropped on it, or anywhere on the page). Each one is
// read in the browser for blanks, uploaded to their account's private
// folder, and recorded. In test mode (staff) nothing is uploaded; results
// are only shown here.
export function ContractUploader({
  accountId,
  testMode,
  title,
  children,
}: {
  accountId: string | null;
  testMode: boolean;
  // The lesson's title (the button goes to its right) and what goes under it.
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const queue = useRef<Item[]>([]);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((all) =>
      all.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );

  async function processQueue() {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length > 0) {
      const item = queue.current.shift()!;
      await processOne(item);
    }
    busy.current = false;
    if (!testMode) router.refresh();
  }

  async function processOne(item: Item) {
    const { id, file } = item;
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      update(id, {
        status: "error",
        error: "Only PDF files can be read for blanks.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      update(id, { status: "error", error: "This file is over 25 MB." });
      return;
    }

    let analysis: ContractAnalysis;
    let bytes: ArrayBuffer;
    try {
      update(id, { status: "reading", progress: "Opening…" });
      bytes = await file.arrayBuffer();
      const doc = await openPdf(bytes);
      analysis = await analyzeContract(doc, (page, total) =>
        update(id, { progress: `Reading page ${page} of ${total}…` }),
      );
      await doc.loadingTask.destroy();
    } catch (err) {
      const name = (err as { name?: string })?.name;
      update(id, {
        status: "error",
        error:
          name === "PasswordException"
            ? "This PDF is password-protected. Remove the password and try again."
            : "We couldn't read this PDF. Try exporting it again as a PDF.",
      });
      return;
    }

    if (testMode || !accountId) {
      update(id, { status: "done", analysis, bytes, progress: undefined });
      return;
    }

    update(id, { status: "uploading", progress: "Uploading…" });
    const storagePath = `${accountId}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await createClient()
      .storage.from("contract-docs")
      .upload(storagePath, file, { contentType: "application/pdf" });
    if (uploadError) {
      update(id, {
        status: "error",
        error: `Upload failed: ${uploadError.message}`,
      });
      return;
    }

    const saved = await saveContractDocument({
      storagePath,
      fileName: file.name,
      fileSize: file.size,
      pageCount: analysis.pageCount,
      blanks: analysis.blanks,
      isScanned: !analysis.hasText,
    });
    if (!saved.ok) {
      update(id, { status: "error", error: saved.error });
      return;
    }
    // It now shows in the saved list below, so drop it from this one.
    setItems((all) => all.filter((it) => it.id !== id));
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map<Item>((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "queued",
    }));
    setItems((all) => [...all, ...added]);
    queue.current.push(...added);
    void processQueue();
  }

  // Files dropped anywhere on the page are added too (the button lights up
  // while they're dragged over it).
  const addRef = useRef(addFiles);
  useEffect(() => {
    addRef.current = addFiles;
  });
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Boolean(e.dataTransfer?.types.includes("Files"));
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addRef.current(e.dataTransfer?.files ?? null);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby="upload-help"
            className={`flex h-[50px] items-center gap-2 rounded-lg border-2 border-dashed px-3.5 text-sm font-semibold transition-colors ${
              dragging
                ? "border-accent bg-accent-soft text-accent"
                : "border-accent/50 bg-surface text-accent hover:border-accent hover:bg-accent-soft/50"
            }`}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
            </svg>
            {/* The note under the title. */}
            <span className="flex flex-col items-stretch justify-center leading-tight">
              {dragging ? "Drop to upload" : "Drag here or choose files"}
              <span
                id="upload-help"
                className="whitespace-nowrap text-center text-[10px] font-medium leading-none text-ink-soft"
              >
                PDFs up to 25 MB each
              </span>
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {children}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">
              {item.file.name}
            </span>
            {item.status === "error" ? (
              <span className="text-sm text-danger">{item.error}</span>
            ) : item.status === "done" && item.analysis ? (
              <span className="text-sm text-ink-soft">
                {item.analysis.pageCount} page
                {item.analysis.pageCount === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-sm text-ink-faint">
                {item.progress ?? "Waiting…"}
              </span>
            )}
          </div>
          {item.status === "done" &&
            item.analysis &&
            !item.analysis.hasText && (
              <p className="mt-2 text-sm text-warning">
                This looks like a scanned copy, so there&rsquo;s no text to read
                blanks from. Upload the original digital PDF if you have it.
              </p>
            )}
          {item.status === "done" && item.analysis?.hasText && item.bytes && (
            <details open className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-accent">
                Review pages
              </summary>
              <div className="mt-3">
                <ContractReviewer
                  source={item.bytes}
                  pageCount={item.analysis.pageCount}
                  initialBlanks={item.analysis.blanks}
                />
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
