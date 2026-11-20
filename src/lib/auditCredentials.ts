import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// OTC passwords sent on the audit form are encrypted before they're saved
// (AES-256-GCM, keyed from the server's Supabase service key, which never
// reaches the browser) and decrypted only for the staff admin page.
function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  return createHash("sha256").update(`otc-audit-credentials:${secret}`).digest();
}

export function encryptCredential(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")}`;
}

// null when it can't be read (e.g. the service key was changed).
export function decryptCredential(stored: string | null): string | null {
  if (!stored?.startsWith("v1:")) return null;
  try {
    const raw = Buffer.from(stored.slice(3), "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
