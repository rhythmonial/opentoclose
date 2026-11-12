"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { contentTypeOf, extensionOf, readContactFile } from "@/lib/contactFiles";
import { UPLOAD_LESSONS, type UploadKind } from "@/lib/uploadLessons";
import { recordUpload, removeUpload } from "@/app/configurator/upload_files/actions";

export type UploadedFile = {
  id: string;
  fileName: string;
  rowCount: number;
  columns: number;
  url: string | null;
};

// Upload Your Contacts / Messages / Tasks: drop in files (read in the
// browser for their columns and row count), see what's uploaded, remove
// any. Matching their columns comes in the Prep lesson.
export function FileUploadLesson({
  kind,
  accountId,
  isStaff,
  initialFiles,
}: {
  kind: UploadKind;
  accountId: string;
  isStaff: boolean;
  initialFiles: UploadedFile[];
}) {
  const router = useRouter();
  const lesson = UPLOAD_LESSONS[kind];
  const [files, setFiles] = useState(initialFiles);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const actionAccount = isStaff ? accountId : null;

  async function upload(file: File) {
    setError(null);
    setBusy(`Reading ${file.name}…`);
    try {
      const table = await readContactFile(file, file.name);
      if (table.columns.length === 0) throw new Error("We couldn't find any rows in that file.");
      setBusy(`Uploading ${file.name}…`);
      const ext = extensionOf(file.name) || "csv";
      const folder = kind === "contacts" ? "" : `${kind}/`;
      const storagePath = `${accountId}/${folder}${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await createClient()
        .storage.from("contact-files")
        .upload(storagePath, file, { contentType: contentTypeOf(file.name) });
      if (uploadError) throw new Error(uploadError.message);
      const result = await recordUpload(kind, actionAccount, {
        fileName: file.name,
        storagePath,
        columns: table.columns,
        rowCount: table.rows.length,
      });
      if (!result.ok || !result.id) throw new Error(result.error ?? "Couldn't save that file.");
      setFiles((all) => [
        ...all,
        { id: result.id!, fileName: file.name, rowCount: table.rows.length, columns: table.columns.length, url: null },
      ]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-8 text-center hover:border-accent">
        <span className="text-sm font-semibold text-ink">{busy ?? `Upload a ${lesson.noun}`}</span>
        <span className="text-xs text-ink-faint">{lesson.formats}. You can upload more than one.</span>
        <input
          type="file"
          multiple
          accept={lesson.accept}
          disabled={Boolean(busy)}
          className="text-xs"
          onChange={async (e) => {
            const picked = [...(e.target.files ?? [])];
            e.target.value = "";
            for (const f of picked) await upload(f);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold text-ink">Uploaded ({files.length})</h2>
          {files.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{f.fileName}</span>
                <span className="block text-xs text-ink-faint">
                  {f.rowCount} row{f.rowCount === 1 ? "" : "s"} &middot; {f.columns} column
                  {f.columns === 1 ? "" : "s"}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs font-semibold">
                {f.url && (
                  <a href={f.url} download={f.fileName} className="text-accent">
                    Download
                  </a>
                )}
                {confirming === f.id ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setFiles((all) => all.filter((x) => x.id !== f.id));
                      setConfirming(null);
                      await removeUpload(kind, actionAccount, f.id);
                      router.refresh();
                    }}
                    className="rounded-md bg-danger px-2.5 py-1 text-white"
                  >
                    Delete?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(f.id)}
                    className="text-ink-faint hover:text-danger"
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
