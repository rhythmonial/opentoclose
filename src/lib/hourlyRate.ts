import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_HOURLY_RATE } from "@/lib/pricing";

export async function getHourlyRate() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "hourly_rate")
    .maybeSingle();
  const rate = Number(data?.value);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_HOURLY_RATE;
}
