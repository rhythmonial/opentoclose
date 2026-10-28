import { redirect } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/TopNav";
import { StaffNav } from "@/components/StaffNav";
import { getSandboxTier, SANDBOX_LABEL } from "@/lib/devSandbox";
import { getVideoSource } from "@/lib/videoEmbed";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { EngagementType } from "@/lib/stepOwnership";
import {
  RESOURCE_CATEGORIES,
  type ResourceCategory,
} from "@/lib/resourceCategories";

const EMPTY_MESSAGE: Record<ResourceCategory, string> = {
  training: "Training videos are on the way.",
  replay: "Call replays will show up here.",
  faq: "No FAQs yet.",
};

const markdownClass = `text-sm leading-relaxed text-ink-soft
  [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
  [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
  [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
  [&_li]:mt-1 first:[&>*]:mt-0`;

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const category: ResourceCategory =
    RESOURCE_CATEGORIES.find((c) => c.value === tab)?.value ?? "training";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: realProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isStaff =
    realProfile?.role === "dev" || realProfile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;
  const isSandboxing = Boolean(sandboxTier);

  if (isStaff && !isSandboxing) {
    return (
      <main className="flex min-h-screen flex-col bg-bg">
        <StaffNav isDev={realProfile?.role === "dev"} />
        <div className="px-4 py-9 sm:px-6 lg:px-12">
          <p className="text-sm text-ink-soft">
            Edit Resource Center content from the Resources tab, or enter a
            Free/DIY/Setup sandbox from the Clients tab to see it as a client.
          </p>
        </div>
      </main>
    );
  }

  const [{ data: profile }, { data: initiation }, { data: items }] =
    await Promise.all([
      isSandboxing
        ? Promise.resolve({ data: null })
        : supabase
            .from("profiles")
            .select("client_accounts(name)")
            .eq("id", user.id)
            .single(),
      isSandboxing
        ? Promise.resolve({ data: { engagement_type: sandboxTier! } })
        : supabase
            .from("setup_initiation")
            .select("engagement_type")
            .eq("client_id", user.id)
            .maybeSingle(),
      supabase
        .from("resource_items")
        .select("*")
        .eq("category", category)
        .order("sort_order"),
    ]);

  const engagementType = (initiation?.engagement_type ??
    "free") as EngagementType;
  // FAQs are open to everyone; training videos and replays are part of
  // the paid plans.
  const isLocked = engagementType === "free" && category !== "faq";

  const businessName = isSandboxing
    ? SANDBOX_LABEL[sandboxTier!]
    : (profile?.client_accounts?.name ?? user.email ?? "Your business");

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <TopNav
        businessName={businessName}
        active="resources"
        sandboxTier={sandboxTier}
      />

      <div className="px-4 pt-6 sm:px-6 sm:pt-9 lg:px-12">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
          Resource Center
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Training videos, call replays and answers to common questions.
        </p>

        <div className="mt-6 flex gap-1 border-b border-border">
          {RESOURCE_CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={`/resources?tab=${c.value}`}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold ${
                category === c.value
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-soft"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-10 pt-6 sm:px-6 lg:px-12 lg:pb-12">
        {isLocked && (
          <div className="rounded-lg border border-accent-soft bg-accent-soft/40 px-4 py-2.5 text-sm font-semibold text-accent">
            Sign up for Setup or DIY to unlock training videos and replays.
          </div>
        )}

        {(items ?? []).length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-ink-soft">
            {EMPTY_MESSAGE[category]}
          </p>
        )}

        {category === "faq"
          ? (items ?? []).map((item) => (
              <details
                key={item.id}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <summary className="cursor-pointer text-[15px] font-bold text-ink">
                  {item.title}
                </summary>
                {item.body && (
                  <div className={`mt-3 ${markdownClass}`}>
                    <ReactMarkdown>{item.body}</ReactMarkdown>
                  </div>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-semibold text-accent"
                  >
                    Learn more &rarr;
                  </a>
                )}
              </details>
            ))
          : (items ?? []).map((item) => {
              const videoSource = item.url ? getVideoSource(item.url) : null;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <h2 className="text-[15px] font-bold text-ink">
                    {item.title}
                  </h2>
                  {item.body && (
                    <div className={`mt-1.5 ${markdownClass}`}>
                      <ReactMarkdown>{item.body}</ReactMarkdown>
                    </div>
                  )}
                  {item.url &&
                    (isLocked ? (
                      <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink-faint">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Locked
                      </div>
                    ) : videoSource ? (
                      <VideoPlayer
                        source={videoSource}
                        title={item.title}
                        className="mt-3 max-w-3xl"
                      />
                    ) : (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch
                      </a>
                    ))}
                </div>
              );
            })}
      </div>
    </main>
  );
}
