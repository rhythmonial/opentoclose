"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import {
  COLOR_NAMES,
  CUSTOM_PREFIX,
  SIDES,
  STARTER_CATEGORIES,
  type CategoryColor,
} from "@/lib/documentCategories";

const STEP_KEY = "categorize_your_documents";
const PAGE = `/configurator/${STEP_KEY}`;
const UUID = /^[0-9a-f-]{36}$/i;

type Result = { ok: boolean; error?: string; id?: string };

// Saves a document's categories and sides. An uploaded contract is saved by
// its contract_document_id (its row is made the first time); one added by
// name, by its own id.
export async function saveDocument(
  accountId: string | null,
  doc: {
    id?: string | null;
    contractDocumentId?: string | null;
    name: string;
    categories: string[];
    sides: string[];
  },
): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };

  const { data: custom } = await supabase
    .from("document_categories")
    .select("id")
    .eq("client_account_id", account);
  const known = new Set([
    ...STARTER_CATEGORIES.map((c) => c.id),
    ...(custom ?? []).map((c) => `${CUSTOM_PREFIX}${c.id}`),
  ]);
  const row = {
    client_account_id: account,
    name: doc.name.trim().slice(0, 160),
    categories: [...new Set(doc.categories)].filter((c) => known.has(c)),
    sides: [...new Set(doc.sides)].filter((s) => SIDES.some((x) => x.value === s)),
    updated_at: new Date().toISOString(),
  };
  if (!row.name) return { ok: false, error: "A document needs a name." };

  if (doc.contractDocumentId) {
    if (!UUID.test(doc.contractDocumentId)) return { ok: false, error: "Unknown document." };
    const { data, error } = await supabase
      .from("prep_documents")
      .upsert(
        { ...row, contract_document_id: doc.contractDocumentId },
        { onConflict: "contract_document_id" },
      )
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath(PAGE);
    return { ok: true, id: data.id };
  }

  if (doc.id) {
    if (!UUID.test(doc.id)) return { ok: false, error: "Unknown document." };
    const { error } = await supabase.from("prep_documents").update(row).eq("id", doc.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(PAGE);
    return { ok: true, id: doc.id };
  }

  const { data, error } = await supabase.from("prep_documents").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, id: data.id };
}

// Removes a document the client added by name (uploaded contracts stay).
export async function removeDocument(accountId: string | null, id: string): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account || !UUID.test(id)) return { ok: false };
  const { error } = await supabase
    .from("prep_documents")
    .delete()
    .eq("id", id)
    .eq("client_account_id", account)
    .is("contract_document_id", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Adds a category of the client's own.
export async function addCategory(
  accountId: string | null,
  name: string,
  color: CategoryColor,
): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, error: "A category needs a name." };
  if (STARTER_CATEGORIES.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
    return { ok: false, error: `"${clean}" is already a category.` };
  }
  const { data, error } = await supabase
    .from("document_categories")
    .insert({
      client_account_id: account,
      name: clean,
      color: COLOR_NAMES.includes(color) ? color : "gray",
    })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? `"${clean}" is already a category.` : error.message,
    };
  }
  revalidatePath(PAGE);
  return { ok: true, id: `${CUSTOM_PREFIX}${data.id}` };
}

// Deletes one of the client's own categories and takes it off their
// documents.
export async function deleteCategory(accountId: string | null, categoryId: string): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  const id = categoryId.startsWith(CUSTOM_PREFIX) ? categoryId.slice(CUSTOM_PREFIX.length) : "";
  if (!account || !UUID.test(id)) return { ok: false };

  const { data: docs } = await supabase
    .from("prep_documents")
    .select("id, categories")
    .eq("client_account_id", account)
    .contains("categories", [categoryId]);
  for (const d of docs ?? []) {
    await supabase
      .from("prep_documents")
      .update({ categories: d.categories.filter((c) => c !== categoryId) })
      .eq("id", d.id);
  }
  const { error } = await supabase
    .from("document_categories")
    .delete()
    .eq("id", id)
    .eq("client_account_id", account);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Marks the lesson complete once every document has a category and a side.
export async function finishCategorizing() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");

  const [{ data: contracts }, { data: docs }] = await Promise.all([
    supabase.from("contract_documents").select("id").eq("client_account_id", accountId),
    supabase
      .from("prep_documents")
      .select("contract_document_id, categories, sides")
      .eq("client_account_id", accountId),
  ]);
  const done = (d?: { categories: string[]; sides: string[] }) =>
    Boolean(d && d.categories.length > 0 && d.sides.length > 0);
  const byContract = new Map((docs ?? []).map((d) => [d.contract_document_id, d] as const));
  const all = [
    ...(contracts ?? []).map((c) => byContract.get(c.id)),
    ...(docs ?? []).filter((d) => !d.contract_document_id),
  ];
  if (all.length === 0 || !all.every(done)) redirect(PAGE);

  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}
