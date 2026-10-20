import { cookies } from "next/headers";

export const IMPERSONATE_COOKIE = "impersonate_client_id";

export async function getImpersonatedClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATE_COOKIE)?.value ?? null;
}
