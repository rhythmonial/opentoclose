import { cookies } from "next/headers";

export const SANDBOX_COOKIE = "sandbox_tier";

export type SandboxTier = "custom" | "diy" | "free";

export const SANDBOX_LABEL: Record<SandboxTier, string> = {
  custom: "Setup Sandbox",
  diy: "DIY Sandbox",
  free: "Free Sandbox",
};

export async function getSandboxTier(): Promise<SandboxTier | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SANDBOX_COOKIE)?.value;
  if (value === "custom" || value === "diy" || value === "free") {
    return value;
  }
  return null;
}
