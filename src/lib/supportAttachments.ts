// Images and videos attached to support questions and replies. Files live
// in the private support-attachments bucket under <uploader id>/; messages
// keep their details, and pages show them through signed links.

export const SUPPORT_BUCKET = "support-attachments";
export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export type Attachment = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export type SignedAttachment = {
  path: string;
  name: string;
  type: string;
  url: string | null;
};

export const isMediaType = (type: string) =>
  type.startsWith("image/") || type.startsWith("video/");

// The attachments a form sent (JSON from AttachmentInput), keeping only the
// sender's own uploads.
export function cleanAttachments(raw: unknown, userId: string): Attachment[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw || "[]");
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Attachment[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { path, name, type, size } = item as Record<string, unknown>;
    if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.includes("..")) continue;
    if (typeof type !== "string" || !isMediaType(type)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({
      path,
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : "Attachment",
      type,
      size: typeof size === "number" && size > 0 ? Math.round(size) : 0,
    });
    if (out.length >= MAX_ATTACHMENTS) break;
  }
  return out;
}

// A stored message's attachments (the jsonb column), typed.
export function storedAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is Attachment =>
      Boolean(a) && typeof a === "object" && typeof (a as Attachment).path === "string",
  );
}
