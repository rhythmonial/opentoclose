import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SUPPORT_BUCKET,
  storedAttachments,
  type SignedAttachment,
} from "@/lib/supportAttachments";

// Signed links (good for an hour) for the attachments on messages the page
// already read, so only messages the viewer can see get links. Returns
// each message's attachments by message id.
export async function signSupportAttachments(
  messages: { id: string; attachments?: unknown }[],
): Promise<Map<string, SignedAttachment[]>> {
  const byMessage = new Map<string, SignedAttachment[]>();
  const all = messages.flatMap((m) =>
    storedAttachments(m.attachments).map((a) => ({ messageId: m.id, ...a })),
  );
  if (all.length === 0) return byMessage;

  const { data } = await createAdminClient()
    .storage.from(SUPPORT_BUCKET)
    .createSignedUrls(
      all.map((a) => a.path),
      60 * 60,
    );
  const urlByPath = new Map((data ?? []).map((u) => [u.path, u.signedUrl] as const));

  for (const a of all) {
    const list = byMessage.get(a.messageId) ?? [];
    list.push({ path: a.path, name: a.name, type: a.type, url: urlByPath.get(a.path) ?? null });
    byMessage.set(a.messageId, list);
  }
  return byMessage;
}
