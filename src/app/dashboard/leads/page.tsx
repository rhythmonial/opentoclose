import { createClient } from "@/lib/supabase/server";
import { LeadStatusSelect } from "@/components/LeadStatusSelect";
import { addLead, deleteLead } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  new: "bg-accent-soft text-accent",
  contacted: "bg-accent-soft text-accent",
  info_sent: "bg-accent-soft text-accent",
  proposal_sent: "bg-warning-soft text-warning",
  won: "bg-success-soft text-success",
  lost: "bg-border-soft text-ink-faint",
};

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="px-12 py-9">
      <h1 className="font-display text-[25px] font-bold text-ink">Leads</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Everyone who&rsquo;s requested info or been added as a prospect, before
        they become a client.
      </p>

      <div className="mt-7 flex gap-8">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Added</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-border-soft last:border-0"
                >
                  <td className="px-5 py-3.5 font-semibold text-ink">
                    {lead.name}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">
                    <div>{lead.email}</div>
                    {lead.phone && (
                      <div className="text-xs text-ink-faint">{lead.phone}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">
                    <div>
                      {lead.source === "request_info" ? "Request Info" : "Manual"}
                    </div>
                    {lead.heard_about && (
                      <div className="text-xs text-ink-faint">
                        {lead.heard_about}
                        {lead.heard_about_detail
                          ? ` — ${lead.heard_about_detail}`
                          : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <LeadStatusSelect leadId={lead.id} status={lead.status} />
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-faint">
                    {new Date(lead.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5">
                    <form action={deleteLead}>
                      <input type="hidden" name="lead_id" value={lead.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-danger"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {(leads ?? []).length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-sm text-ink-soft" colSpan={6}>
                    No leads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="w-[320px] shrink-0 rounded-xl border border-border bg-surface p-5">
          <h3 className="text-[15px] font-bold text-ink">Add a lead</h3>
          <form action={addLead} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Name</span>
              <input
                name="name"
                required
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Email</span>
              <input
                name="email"
                type="email"
                required
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">
                Phone (optional)
              </span>
              <input
                name="phone"
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">Notes</span>
              <textarea
                name="notes"
                rows={3}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              Add lead
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
