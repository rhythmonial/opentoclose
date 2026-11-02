"use client";

import { useState } from "react";
import { openPdf } from "@/lib/pdfjs";
import { analyzeContract, type ContractAnalysis } from "@/lib/contractBlanks";
import { WorkflowFieldPicker } from "@/components/WorkflowFieldPicker";

// Staff test mode for Assign Your Workflow Fields: pick any PDF, it's read
// for fields the way an upload is, and the picker runs on it. Nothing is
// uploaded or saved.
export function WorkflowFieldsTester() {
  const [file, setFile] = useState<{ bytes: ArrayBuffer; analysis: ContractAnalysis } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-7 text-center">
        <span className="text-sm font-semibold text-ink">
          Choose a contract PDF to try the picker with
        </span>
        <span className="text-xs text-ink-faint">{status ?? "It isn't uploaded or saved"}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="text-xs"
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            setFile(null);
            setStatus("Reading…");
            try {
              const bytes = await picked.arrayBuffer();
              const doc = await openPdf(bytes);
              const analysis = await analyzeContract(doc, (n, total) =>
                setStatus(`Reading page ${n} of ${total}…`),
              );
              await doc.loadingTask.destroy();
              setFile({ bytes, analysis });
              setStatus(`${picked.name}: ${analysis.blanks.length} fields found`);
            } catch {
              setStatus("Couldn't read that PDF.");
            }
          }}
        />
      </label>
      {file && (
        <WorkflowFieldPicker
          source={file.bytes}
          pageCount={file.analysis.pageCount}
          blanks={file.analysis.blanks}
          initialSelected={[]}
        />
      )}
    </div>
  );
}
