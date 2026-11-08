"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  SUPPORT_BUCKET,
  isMediaType,
  type Attachment,
} from "@/lib/supportAttachments";

type Item = {
  key: string;
  name: string;
  type: string;
  size: number;
  preview: string | null;
  state: "uploading" | "done" | "failed";
  path?: string;
  error?: string;
};

const sizeLabel = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// "Add images or videos" for a support form. Files upload as soon as
// they're picked; the form sends their details in a hidden `attachments`
// field, and can't be sent while one is still uploading.
export function AttachmentInput() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const waitRef = useRef<HTMLInputElement>(null);
  const uploading = items.some((i) => i.state === "uploading");

  // Clear when the form resets (after it's sent).
  useEffect(() => {
    const form = fileRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setItems([]);
      setError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  useEffect(() => {
    waitRef.current?.setCustomValidity(
      uploading ? "Wait for your files to finish uploading." : "",
    );
  }, [uploading]);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function add(files: FileList | null) {
    setError(null);
    if (!files?.length) return;
    const room = MAX_ATTACHMENTS - items.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError(`Up to ${MAX_ATTACHMENTS} files per message.`);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in again to attach files.");
      return;
    }

    for (const file of picked) {
      const key = crypto.randomUUID();
      const type = file.type || "application/octet-stream";
      const base: Item = {
        key,
        name: file.name,
        type,
        size: file.size,
        preview: type.startsWith("image/") ? URL.createObjectURL(file) : null,
        state: "uploading",
      };
      if (!isMediaType(type)) {
        setItems((prev) => [...prev, { ...base, state: "failed", error: "Images and videos only" }]);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setItems((prev) => [...prev, { ...base, state: "failed", error: "Over 50 MB" }]);
        continue;
      }
      setItems((prev) => [...prev, base]);
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80) || "file";
      const path = `${user.id}/${key}-${safe}`;
      supabase.storage
        .from(SUPPORT_BUCKET)
        .upload(path, file, { contentType: type })
        .then(({ error: upErr }) =>
          update(key, upErr ? { state: "failed", error: "Upload failed" } : { state: "done", path }),
        );
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function remove(item: Item) {
    setItems((prev) => prev.filter((i) => i.key !== item.key));
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (item.path) void createClient().storage.from(SUPPORT_BUCKET).remove([item.path]);
  }

  const uploaded: Attachment[] = items
    .filter((i) => i.state === "done" && i.path)
    .map((i) => ({ path: i.path!, name: i.name, type: i.type, size: i.size }));

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="attachments" value={JSON.stringify(uploaded)} />
      <input
        ref={waitRef}
        aria-hidden
        tabIndex={-1}
        value=""
        onChange={() => {}}
        className="sr-only"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(e) => add(e.target.files)}
        className="hidden"
      />

      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((i) => (
            <li
              key={i.key}
              className={`flex max-w-full items-center gap-2 rounded-lg border bg-bg py-1.5 pl-1.5 pr-2 text-xs ${
                i.state === "failed" ? "border-danger/40" : "border-border"
              }`}
            >
              {i.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.preview} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-border-soft text-ink-soft">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
              <span className="min-w-0">
                <span className="block max-w-[11rem] truncate font-medium text-ink">{i.name}</span>
                <span className={i.state === "failed" ? "text-danger" : "text-ink-faint"}>
                  {i.state === "uploading"
                    ? "Uploading…"
                    : i.state === "failed"
                      ? i.error
                      : sizeLabel(i.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${i.name}`}
                className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-border-soft hover:text-ink"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length < MAX_ATTACHMENTS && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 self-start text-sm font-semibold text-accent hover:underline"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          Add images or videos
        </button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
