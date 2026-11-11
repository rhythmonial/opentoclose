"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { TIME_FRAMES } from "@/lib/dateCalculations";
import { cleanCustomFields, OTC_FIELDS } from "@/lib/otcFields";

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
  // "" leaves it without a type.
  if (!okId || (timeFrame && !TIME_FRAMES.some((t) => t.value === timeFrame))) return { ok: false, error: "Unknown choice." };
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
      time_frame: timeFrame || null,
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

const idOk = (id: string) => OTC_FIELDS.some((f) => f.id === id) || /^new-otc:[0-9a-f-]{36}$/i.test(id);

// Checks (or unchecks) a date as calculated. Unchecking also takes off the
// number field picked for it.
export async function setCalcDate(
  accountId: string | null,
  dateId: string,
  on: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!idOk(dateId)) return { ok: false, error: "Unknown field." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { data } = await supabase
    .from("client_otc_field_selections")
    .select("calc_dates, number_ties")
    .eq("client_account_id", account)
    .maybeSingle();
  const list = (Array.isArray(data?.calc_dates) ? data.calc_dates : []).filter(
    (x): x is string => typeof x === "string" && x !== dateId,
  );
  const ties = { ...((data?.number_ties ?? {}) as Record<string, string>) };
  if (!on) {
    for (const [n, d] of Object.entries(ties)) if (d === dateId) delete ties[n];
    await supabase
      .from("date_calculations")
      .update({ number_field: null, days_on_contract: false, updated_at: new Date().toISOString() })
      .eq("client_account_id", account)
      .eq("otc_field", dateId);
  }
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      calc_dates: on ? [...list, dateId].slice(-500) : list,
      number_ties: ties,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Adds a date or number field of their own (in a section), as the +
// in Customize Your Fields does.
export async function addOwnField(
  accountId: string | null,
  field: { id: string; name: string; sectionId: string; kind: "date" | "number" },
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { data } = await supabase
    .from("client_otc_field_selections")
    .select("custom_fields")
    .eq("client_account_id", account)
    .maybeSingle();
  const custom = cleanCustomFields([...(Array.isArray(data?.custom_fields) ? data.custom_fields : []), field]);
  if (!custom.some((f) => f.id === field.id)) return { ok: false, error: "Couldn't add that field." };
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    { client_account_id: account, custom_fields: custom, updated_at: new Date().toISOString() },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Default type: how days are counted, set on every date given (the ones
// with a number field) and kept for dates paired later. Taking it off ("")
// leaves those dates without a type.
export async function setDefaultTimeFrame(
  accountId: string | null,
  timeFrame: string,
  dateIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  // "" takes the default off.
  if (timeFrame && !TIME_FRAMES.some((t) => t.value === timeFrame)) return { ok: false, error: "Unknown choice." };
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    { client_account_id: account, default_time_frame: timeFrame || null, updated_at: new Date().toISOString() },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  const ids = dateIds.filter(idOk).slice(0, 500);
  if (ids.length > 0) {
    const { error: calcError } = await supabase
      .from("date_calculations")
      .update({ time_frame: timeFrame || null, updated_at: new Date().toISOString() })
      .eq("client_account_id", account)
      .in("otc_field", ids);
    if (calcError) return { ok: false, error: calcError.message };
  }
  revalidatePath(PAGE);
  revalidatePath("/configurator/select_your_date_fields");
  return { ok: true };
}

// "Refresh your dates": Select Your Date Fields back to how it started (no dates
// paired with number fields here, none checked, no default type), with the
// dates' types taken off. Placeholders and fields they added
// stay.
export async function resetSelectYourDates(accountId: string | null): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const { data } = await supabase
    .from("client_otc_field_selections")
    .select("number_ties")
    .eq("client_account_id", account)
    .maybeSingle();
  const dates = Object.values((data?.number_ties ?? {}) as Record<string, string>).filter(idOk);
  if (dates.length > 0) {
    await supabase
      .from("date_calculations")
      .update({ time_frame: null, updated_at: new Date().toISOString() })
      .eq("client_account_id", account)
      .in("otc_field", dates);
  }
  const { error } = await supabase.from("client_otc_field_selections").upsert(
    {
      client_account_id: account,
      number_ties: {},
      numbers_not_dates: [],
      calc_dates: [],
      default_time_frame: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}
