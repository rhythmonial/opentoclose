"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { loadFieldUse } from "@/lib/fieldUse";
import {
  cleanChoiceEdits,
  cleanMoves,
  orgFields,
  reconcileLayout,
  type ChoiceEdits,
  type Layout,
  type Move,
} from "@/lib/fieldOrganization";

const STEP_KEY = "organize_your_fields";
const PAGE = `/configurator/${STEP_KEY}`;

// Saves how the client has arranged their fields, adding the moves they
// made since the last save to the record of every move.
export async function saveFieldOrganization(
  accountId: string | null,
  layout: Layout,
  moves: Move[],
  choiceEdits: ChoiceEdits,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const use = await loadFieldUse(supabase, account);
  const fields = orgFields(use.inUse, use.newFields, use.custom, use.contractOptions);
  const clean = reconcileLayout(layout, fields);
  const { data: saved } = await supabase
    .from("client_field_organization")
    .select("moves")
    .eq("client_account_id", account)
    .maybeSingle();
  const all = [...cleanMoves(saved?.moves ?? []), ...cleanMoves(moves)].slice(-5000);
  const { error } = await supabase.from("client_field_organization").upsert(
    {
      client_account_id: account,
      layout: clean,
      moves: all,
      choice_edits: cleanChoiceEdits(choiceEdits, fields),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// "I'm done organizing my fields": the lesson's done, and the instructions
// are ready to download.
export async function finishOrganizeFields() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  const { data: saved } = await supabase
    .from("client_field_organization")
    .select("layout")
    .eq("client_account_id", accountId)
    .maybeSingle();
  const use = await loadFieldUse(supabase, accountId);
  await supabase.from("client_field_organization").upsert(
    {
      client_account_id: accountId,
      layout: reconcileLayout(saved?.layout, orgFields(use.inUse, use.newFields, use.custom, use.contractOptions)),
      done_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_account_id" },
  );
  await approveStep(supabase, user.id, accountId, STEP_KEY);
  revalidatePath(PAGE);
  redirect(`${PAGE}?done=1`);
}
