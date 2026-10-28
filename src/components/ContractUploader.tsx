"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { openPdf } from "@/lib/pdfjs";
import { analyzeContract, type ContractAnalysis } from "@/lib/contractBlanks";
import { saveContractDocument } from "@/app/configurator/upload_your_contract_docs/actions";
import { ContractPreview } from "@/components/ContractPreview";

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

// Lets a client pick or drop contract PDFs. Each one is read in the browser
// for blanks, uploaded to their account's private folder, and recorded. In
// test mode (staff) nothing is uploaded; results are only shown here.
export function ContractUploader({
  accountId,
  testMode,
}: {
  accountId: string | null;
  testMode: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const queue = useRef<Item[]>([]);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((all) => all.map((it) => (it.id === id ? { ...it, ...patch } : it)));

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
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      update(id, { status: "error", error: "Only PDF files can be read for blanks." });
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
      update(id, { status: "error", error: `Upload failed: ${uploadError.message}` });
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

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-border bg-surface"
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
        </svg>
        <p className="text-sm font-semibold text-ink">
          Drag your contract PDFs here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-accent underline"
          >
            choose files
          </button>
        </p>
        <p className="text-xs text-ink-faint">PDF only, up to 25 MB each</p>
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

      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-ink">
              {item.file.name}
            </span>
            {item.status === "error" ? (
              <span className="text-sm text-danger">{item.error}</span>
            ) : item.status === "done" && item.analysis ? (
              <span className="text-sm text-ink-soft">
                {item.analysis.pageCount} page{item.analysis.pageCount === 1 ? "" : "s"} &middot;{" "}
                {item.analysis.blanks.length} blank{item.analysis.blanks.length === 1 ? "" : "s"} found
              </span>
            ) : (
              <span className="text-sm text-ink-faint">{item.progress ?? "Waiting…"}</span>
            )}
          </div>
          {item.status === "done" && item.analysis && !item.analysis.hasText && (
            <p className="mt-2 text-sm text-warning">
              This looks like a scanned copy, so there&rsquo;s no text to read
              blanks from. Upload the original digital PDF if you have it.
            </p>
          )}
          {item.status === "done" && item.analysis?.hasText && item.bytes && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-accent">
                Review blanks
              </summary>
              <div className="mt-3">
                <ContractPreview
                  source={item.bytes}
                  blanks={item.analysis.blanks}
                  pageCount={item.analysis.pageCount}
                />
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
