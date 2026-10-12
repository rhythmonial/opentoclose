import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardHome() {
  const supabase = await createClient();

  const [
    { count: clientCount },
    { count: pendingReviewCount },
    { count: activeLeadCount },
    { data: hoursLog },
  ] = await Promise.all([
    supabase.from("client_accounts").select("*", { count: "exact", head: true }),
    supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(won,lost)"),
    supabase.from("hours_log").select("hours"),
  ]);

  const totalHoursLogged = (hoursLog ?? []).reduce(
    (sum, h) => sum + Number(h.hours),
    0,
  );

  const cards = [
    {
      label: "Active clients",
      value: clientCount ?? 0,
      href: "/dashboard/clients",
    },
    {
      label: "Pending reviews",
      value: pendingReviewCount ?? 0,
      href: "/dashboard/tasks",
      highlight: (pendingReviewCount ?? 0) > 0,
    },
    {
      label: "Active leads",
      value: activeLeadCount ?? 0,
      href: "/dashboard/leads",
    },
    {
      label: "Hours logged (all time)",
      value: totalHoursLogged.toFixed(1),
      href: "/dashboard/stats",
    },
  ];

  return (
    <main className="px-12 py-9">
      <h1 className="font-display text-[25px] font-bold text-ink">
        Dashboard
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Everything running through OTC Setup, at a glance.
      </p>

      <div className="mt-7 grid grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-xl border p-5 ${
              card.highlight
                ? "border-warning/30 bg-warning-soft"
                : "border-border bg-surface"
            }`}
          >
            <div className="font-display text-2xl font-bold text-ink">
              {card.value}
            </div>
            <div className="mt-1 text-sm text-ink-soft">{card.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <Link
          href="/dashboard/clients"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <h3 className="text-[15px] font-bold text-ink">View all clients</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Stage, hours used vs. purchased, and status for every client.
          </p>
        </Link>
        <Link
          href="/dashboard/tasks"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <h3 className="text-[15px] font-bold text-ink">Review queue</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Prep sheets and submissions waiting on your approval.
          </p>
        </Link>
        <Link
          href="/dashboard/setup-steps"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <h3 className="text-[15px] font-bold text-ink">Edit setup steps</h3>
          <p className="mt-1 text-sm text-ink-soft">
            The checklist clients see, fully editable — no redeploy needed.
          </p>
        </Link>
        <Link
          href="/dashboard/leads"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <h3 className="text-[15px] font-bold text-ink">Leads</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Everyone who&rsquo;s requested info but hasn&rsquo;t signed up yet.
          </p>
        </Link>
      </div>
    </main>
  );
}
