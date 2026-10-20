import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { MarkdownTextarea } from "@/components/MarkdownTextarea";
import {
  RESOURCE_CATEGORIES,
  type ResourceCategory,
} from "@/lib/resourceCategories";
import {
  addResourceItem,
  updateResourceItem,
  deleteResourceItem,
} from "./actions";

const FIELD_HINTS: Record<
  ResourceCategory,
  { title: string; url: string; body: string }
> = {
  training: {
    title: "Video title",
    url: "Video link (YouTube, Vimeo or Loom embed automatically)",
    body: "Description (optional)",
  },
  replay: {
    title: "Replay title",
    url: "Recording link",
    body: "Notes (optional)",
  },
  faq: {
    title: "Question",
    url: "Related link (optional)",
    body: "Answer",
  },
};

const inputClass =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export default async function ResourcesEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const category: ResourceCategory =
    RESOURCE_CATEGORIES.find((c) => c.value === tab)?.value ?? "training";
  const hints = FIELD_HINTS[category];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "dev") {
    redirect("/dashboard");
  }

  const { data: items } = await supabase
    .from("resource_items")
    .select("*")
    .eq("category", category)
    .order("sort_order");

  return (
    <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
      <h1 className="font-script text-[34px] leading-tight text-ink sm:text-[42px]">
        Resources
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        What clients see in their Resource Center. Changes show up right away.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {RESOURCE_CATEGORIES.map((c) => (
          <Link
            key={c.value}
            href={`/dashboard/resources?tab=${c.value}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              category === c.value
                ? "bg-accent text-white"
                : "border border-border text-ink-soft"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {(items ?? []).map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <form
              id={`resource-${item.id}`}
              action={updateResourceItem}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={item.id} />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  {hints.title}
                </span>
                <input
                  name="title"
                  required
                  defaultValue={item.title}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">
                  {hints.url}
                </span>
                <input
                  name="url"
                  type="url"
                  defaultValue={item.url ?? ""}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-ink-soft">
                  {hints.body}
                </span>
                <MarkdownTextarea
                  name="body"
                  rows={3}
                  defaultValue={item.body ?? ""}
                />
              </label>
            </form>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="submit"
                form={`resource-${item.id}`}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
              <form action={deleteResourceItem}>
                <input type="hidden" name="id" value={item.id} />
                <ConfirmSubmitButton
                  confirmMessage={`Delete "${item.title}"? This cannot be undone.`}
                  title="Delete"
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-danger"
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}

        {(items ?? []).length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
            Nothing here yet.
          </p>
        )}

        <details className="rounded-xl border border-dashed border-border bg-bg p-5">
          <summary className="cursor-pointer text-sm font-semibold text-accent">
            + Add to{" "}
            {RESOURCE_CATEGORIES.find((c) => c.value === category)?.label}
          </summary>
          <form
            action={addResourceItem}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="category" value={category} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">
                {hints.title}
              </span>
              <input name="title" required className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">
                {hints.url}
              </span>
              <input name="url" type="url" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-ink-soft">
                {hints.body}
              </span>
              <MarkdownTextarea name="body" rows={3} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Add
              </button>
            </div>
          </form>
        </details>
      </div>
    </main>
  );
}
