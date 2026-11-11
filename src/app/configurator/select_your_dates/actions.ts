"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { TIME_FRAMES } from "@/lib/dateCalculations";
import { OTC_FIELDS } from "@/lib/otcFields";

const STEP_KEY = "select_your_dates";
const PAGE = `/configurator/${STEP_KEY}`;

// How a date's days are counted (chosen on its number field's row; the
// date shows the same), kept with its calculation in Calculate Your Dates.
export async function setDateTimeFrame(
  accountId: string | null,
  dateId: string,
  timeFrame: string,
): Promise<{ ok: boolean; error?: string }> {
  const okId = OTC_FIELDS.some((f) => f.id === dateId) || /^new-otc:[0-9a-f-]{36}$/i.test(dateId);
  if (!okId || !TIME_FRAMES.some((t) => t.value === timeFrame)) return { ok: false, error: "Unknown choice." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { data: existing } = await supabase
    .from("date_calculations")
    .select("*")
    .eq("client_account_id", account)
    .eq("otc_field", dateId)
    .maybeSingle();
  const { error } = await supabase.from("date_calculations").upsert(
    {
      ...(existing ?? { enabled: true }),
      client_account_id: account,
      otc_field: dateId,
      time_frame: timeFrame,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id,otc_field" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/configurator/select_your_date_fields");
  return { ok: true };
}

// "I'm Done Selecting Dates": the lesson's done.
export async function finishSelectYourDates() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  await approveStep(supabase, user.id, accountId, STEP_KEY);
  revalidatePath(PAGE);
  redirect("/portal");
}
