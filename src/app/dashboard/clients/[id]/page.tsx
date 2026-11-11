import Link from "next/link";
import { formatPhone } from "@/lib/phone";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { LogHoursButton } from "@/components/LogHoursButton";
import { TechSupportButton } from "@/components/TechSupportButton";
import { StepOwnerIcon } from "@/components/StepOwnerIcon";
import { TimerButton } from "@/components/TimerButton";
import {
  effectiveOwner,
  type EngagementType,
  type PlanType,
} from "@/lib/stepOwnership";
import {
  approveSubmission,
  returnSubmission,
  markStaffStepComplete,
  markUpgraded,
} from "../../actions";
import { logHours, logTimedHours, deleteClientAccount } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { InitiationSummary } from "@/components/InitiationSummary";
import { inUploadOrder } from "@/lib/docOrder";
import { signSupportAttachments } from "@/lib/signSupportAttachments";
import {
  AttachmentList,
  SupportStatusBadge,
  SupportThread,
  type SupportMessage,
} from "@/components/SupportThread";

const ENGAGEMENT_LABEL: Record<string, string> = {
  free: "Free",
  custom: "Setup ($999 + $55/mo)",
  diy: "DIY ($55/mo)",
};

const STEP_STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  returned: "Needs Changes",
  approved: "Complete",
  locked: "Locked",
};

const ROLE_LABEL: Record<string, string> = {
  client_owner: "Owner",
  client_admin: "Admin",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ticket?: string }>;
}) {
  const { id } = await params;
  const { error, ticket: openedTicket } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: viewer } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const canDelete = viewer?.role === "dev";

  const { data: account } = await supabase
    .from("client_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (!account) {
    notFound();
  }

  const [{ data: members }, { data: steps }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, email, name, first_name, last_name, phone, first_login_at")
      .eq("client_account_id", id)
      .order("created_at"),
    supabase
      .from("setup_steps")
      .select("*")
      .eq("path", account.setup_path ?? "custom")
      .order("sort_order"),
  ]);

  const owner = (members ?? []).find((m) => m.role === "client_owner") ?? members?.[0];
  const memberIds = (members ?? []).map((m) => m.id);

    // Lessons they asked our team to set up: open ones are starred below;
  // every one they've requested is what hours get logged against.
  const { data: setUpRequests } = await supabase
    .from("setup_requests")
    .select("step_id, done_at")
    .eq("client_account_id", id);
  const requestedStepIds = new Set(
    (setUpRequests ?? []).filter((r) => !r.done_at).map((r) => r.step_id),
  );
  const everRequestedStepIds = new Set((setUpRequests ?? []).map((r) => r.step_id));

  const { data: ticketRows } = memberIds.length
    ? await supabase
        .from("support_tickets")
        .select("id, client_id, subject, status, step_id, created_at")
        .in("client_id", memberIds)
        .order("created_at")
    : { data: [] };
  // Their questions still in play (waiting on us, or answered and waiting
  // on them), plus the one opened from the Clients page; waiting first.
  const supportTickets = (ticketRows ?? [])
    .filter((t) => t.status !== "closed" || t.id === openedTicket)
    .sort((a, b) => Number(b.status === "open") - Number(a.status === "open"));
  const openQuestionCount = supportTickets.filter((t) => t.status === "open").length;
  const { data: supportMessages } = supportTickets.length
    ? await supabase
        .from("support_messages")
        .select("id, ticket_id, author_id, body, created_at, attachments")
        .in(
          "ticket_id",
          supportTickets.map((t) => t.id),
        )
        .order("created_at")
    : { data: [] };
  const attachmentsByMessage = await signSupportAttachments(supportMessages ?? []);

  const [
    { data: statuses },
    { data: submissions },
    { data: hoursLog },
    { data: initiation },
    { data: stepPurchases },
    { data: otcCredentials },
  ] =
    await Promise.all([
      owner
        ? supabase
            .from("client_step_status")
            .select("step_id, status, updated_at")
            .eq("client_id", owner.id)
        : Promise.resolve({ data: [] }),
      owner
        ? supabase
            .from("submissions")
            .select("*")
            .eq("client_id", owner.id)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      memberIds.length > 0
        ? supabase
            .from("hours_log")
            .select("*")
            .in("client_id", memberIds)
            .order("logged_date", { ascending: false })
        : Promise.resolve({ data: [] }),
      owner
        ? supabase
            .from("setup_initiation")
            .select("*")
            .eq("client_id", owner.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      owner
        ? supabase
            .from("payments")
            .select("step_id")
            .eq("client_id", owner.id)
            .eq("kind", "step")
        : Promise.resolve({ data: [] }),
      owner
        ? supabase
            .from("otc_credentials")
            .select("password")
            .eq("client_id", owner.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // Contract PDFs the client uploaded, with links that work for an hour.
  const { data: contractDocs } = await supabase
    .from("contract_documents")
    .select("*")
    .eq("client_account_id", account.id)
    .order("created_at");
  const { data: contractUrls } =
    contractDocs && contractDocs.length > 0
      ? await supabase.storage
          .from("contract-docs")
          .createSignedUrls(
            contractDocs.map((d) => d.storage_path),
            60 * 60,
          )
      : { data: [] };
  const contractUrlByPath = new Map(
    (contractUrls ?? []).map((u) => [u.path, u.signedUrl] as const),
  );

  const purchasedStepIds = new Set(
    (stepPurchases ?? []).map((p) => p.step_id).filter(Boolean),
  );

  const statusByStepId = new Map((statuses ?? []).map((s) => [s.step_id, s.status]));
  const latestSubmissionByStep = new Map(
    (submissions ?? []).map((s) => [s.step_id, s]),
  );

  const stepTitleById = new Map((steps ?? []).map((st) => [st.id, st.title]));
  // A teammate's name and phone: from the invite form, else (for the
  // owner) their setup form, else their profile's full name split at the
  // first space.
  const memberDetails = (m: {
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  }) => {
    const [first = "", ...rest] = (m.name ?? "").trim().split(/\s+/);
    const fromForm = m.id === owner?.id ? initiation : null;
    return {
      first: m.first_name?.trim() || fromForm?.first_name?.trim() || first,
      last: m.last_name?.trim() || fromForm?.last_name?.trim() || rest.join(" "),
      phone: m.phone?.trim() || fromForm?.cell_phone?.trim() || "",
    };
  };
  const hoursUsed = (hoursLog ?? []).reduce((sum, h) => sum + Number(h.hours), 0);
  const engagementType = (initiation?.engagement_type ?? "free") as EngagementType;
  // Staff always see the full task list for a client regardless of plan;
  // free clients follow the DIY rules.
  const ownershipPlan: PlanType = engagementType === "custom" ? "custom" : "diy";

  const phases = Array.from(new Set((steps ?? []).map((s) => s.phase ?? "General")));
  const sortedSteps = (steps ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  // Only the pillars they've reached: everything up to the one they're on
  // (the first with an unfinished step), plus any later pillar where
  // they've already finished or sent in a step (just opening a lesson
  // doesn't count). Later pillars show once they get there.
  const nextStep = sortedSteps.find((st) => statusByStepId.get(st.id) !== "approved");
  const currentIndex = nextStep
    ? phases.indexOf(nextStep.phase ?? "General")
    : phases.length - 1;
  const progressed = new Set(["approved", "submitted", "returned"]);
  const startedPhases = new Set(
    sortedSteps
      .filter(
        (st) => progressed.has(statusByStepId.get(st.id) ?? "") || requestedStepIds.has(st.id),
      )
      .map((st) => st.phase ?? "General"),
  );
  const visiblePhases = phases.filter(
    (phase, i) => i <= currentIndex || startedPhases.has(phase),
  );
  const hiddenPhaseCount = phases.length - visiblePhases.length;

  return (
    <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-12">
      <Link href="/dashboard/clients" className="text-sm font-medium text-accent">
        &larr; Back to clients
      </Link>

      {error && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink sm:text-[28px]">
              {account.name}
            </h1>
            {canDelete && (
              <form action={deleteClientAccount}>
                <input type="hidden" name="account_id" value={account.id} />
                <ConfirmSubmitButton
                  confirmMessage={`Permanently delete ${account.name}? This removes the account, every login on it, and all of its progress, hours, initiation form and support questions. This cannot be undone.`}
                  title="Delete this client account"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-danger"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-soft">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase font-caption tracking-wide ${
                engagementType === "diy"
                  ? "bg-warning-soft text-warning"
                  : engagementType === "free"
                    ? "bg-border-soft text-ink-faint"
                    : "bg-accent-soft text-accent"
              }`}
            >
              {ENGAGEMENT_LABEL[engagementType]}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TechSupportButton
            openCount={openQuestionCount}
            defaultOpen={Boolean(openedTicket)}
          >
            {supportTickets.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-soft">
                No questions from this client right now.
              </p>
            ) : (
          <div className="divide-y divide-border">
            {supportTickets.map((t) => {
              const asker = (members ?? []).find((m) => m.id === t.client_id);
              const stepTitle = t.step_id
                ? (steps ?? []).find((s) => s.id === t.step_id)?.title
                : undefined;
              const messages: SupportMessage[] = (supportMessages ?? [])
                .filter((m) => m.ticket_id === t.id)
                .map((m) => ({
                  id: m.id,
                  body: m.body,
                  created_at: m.created_at,
                  fromStaff: m.author_id !== t.client_id,
                  attachments: attachmentsByMessage.get(m.id),
                }));
              // Their question up top; the thread below is the replies.
              const [question, ...replies] = messages;
              return (
                <div key={t.id} className="px-5 py-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                        Subject
                      </div>
                      <div className="font-semibold text-ink">{t.subject}</div>
                      <div className="mt-0.5 text-xs text-ink-faint">
                        {asker?.email ?? "Client"}
                        {stepTitle && <> &middot; {stepTitle}</>} &middot; asked{" "}
                        {new Date(t.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <SupportStatusBadge status={t.status} />
                  </div>
                  {question && (
                    <div className="mb-3">
                      <div className="text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                        Question
                      </div>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border-soft bg-bg px-4 py-3 text-sm text-ink">
                        {question.body}
                      </p>
                      <AttachmentList attachments={question.attachments} />
                    </div>
                  )}
                  <SupportThread
                    ticketId={t.id}
                    status={t.status}
                    messages={replies}
                    viewerIsStaff
                    clientLabel={asker?.email ?? account.name}
                  />
                </div>
              );
            })}
          </div>
            )}
          </TechSupportButton>
        {owner && (
          <LogHoursButton
            accountId={account.id}
            clientId={owner.id}
            action={logHours}
            // Only the lessons they've asked our team to set up.
            lessons={sortedSteps
              .filter((st) => everRequestedStepIds.has(st.id))
              .map((st) => ({
              id: st.id,
              title: st.title,
              phase: st.phase ?? "General",
              section: st.section,
              done: statusByStepId.get(st.id) === "approved",
            }))}
          />
        )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-ink-soft">Hours</div>
          <div className="mt-1 font-display text-xl font-bold text-ink">
            {hoursUsed.toFixed(1)} / {Number(account.hours_purchased).toFixed(1)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-ink-soft">Team size</div>
          <div className="mt-1 font-display text-xl font-bold text-ink">
            {members?.length ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-sm text-ink-soft">Tasks complete</div>
          <div className="mt-1 font-display text-xl font-bold text-ink">
            {(steps ?? []).filter((s) => statusByStepId.get(s.id) === "approved").length}
            {" / "}
            {(steps ?? []).length}
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-ink">Team</h2>
        {(members ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No team members yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                  <th className="py-1.5 pr-5">Role</th>
                  <th className="py-1.5 pr-5">First name</th>
                  <th className="py-1.5 pr-5">Last name</th>
                  <th className="py-1.5 pr-5">Email</th>
                  <th className="py-1.5 pr-5">Phone</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {(members ?? []).map((member) => {
                  const person = memberDetails(member);
                  return (
                    <tr key={member.id}>
                      <td className="py-1.5 pr-5 font-semibold text-ink">
                        {ROLE_LABEL[member.role] ?? member.role}
                      </td>
                      <td className="py-1.5 pr-5 text-ink">{person.first || "—"}</td>
                      <td className="py-1.5 pr-5 text-ink">{person.last || "—"}</td>
                      <td className="py-1.5 pr-5 text-ink-soft">
                        {member.email ? (
                          <a href={`mailto:${member.email}`} className="hover:text-accent">
                            {member.email}
                          </a>
                        ) : (
                          "Pending"
                        )}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-5 text-ink-soft">
                        {person.phone ? (
                          <a href={`tel:${person.phone.replace(/\D/g, "")}`} className="hover:text-accent">
                            {formatPhone(person.phone)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide ${
                            member.first_login_at
                              ? "bg-success-soft text-success"
                              : "bg-accent-soft text-accent"
                          }`}
                        >
                          {(member.first_login_at ? "active" : "invited").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {initiation?.upgrade_requested_at && owner && (
        <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-accent-soft bg-accent-soft/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="text-sm font-bold text-ink">
              Wants to upgrade to Setup
            </div>
            <div className="text-xs text-ink-soft">
              Requested{" "}
              {new Date(initiation.upgrade_requested_at).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric", year: "numeric" },
              )}
            </div>
          </div>
          <form action={markUpgraded}>
            <input type="hidden" name="client_id" value={owner.id} />
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Mark as Upgraded
            </button>
          </form>
        </div>
      )}

      <InitiationSummary
        initiation={initiation}
        otcPassword={otcCredentials?.password ?? null}
      />

      <details className="mt-4 rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-5 py-3.5">
          <span className="text-[15px] font-bold text-ink">
            Contract Documents ({contractDocs?.length ?? 0})
          </span>
          <span className="text-xs text-ink-faint">
            {contractDocs && contractDocs.length > 0
              ? `${contractDocs.filter((d) => d.reviewed_at).length} of ${contractDocs.length} reviewed`
              : "None uploaded yet"}
          </span>
        </summary>
        {contractDocs && contractDocs.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border-soft px-5 py-4">
            {/* Each opens on its page in Upload Your Contracts (/doc1, /doc2…). */}
            {inUploadOrder(contractDocs).map((doc, i) => {
              const url = contractUrlByPath.get(doc.storage_path);
              return (
                <div
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <Link
                    href={`/configurator/upload_your_contract_docs/doc${i + 1}?client=${account.id}`}
                    className="min-w-0 hover:text-accent"
                  >
                    <span className="block truncate text-sm font-semibold text-ink">{doc.file_name}</span>
                    <span className="block text-xs text-ink-faint">
                      {doc.page_count ?? 0} page{doc.page_count === 1 ? "" : "s"} &middot; Uploaded{" "}
                      {new Date(doc.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </Link>
                  <span className="flex items-center gap-3">
                    {doc.is_scanned ? (
                      <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
                        Scanned copy
                      </span>
                    ) : doc.reviewed_at ? (
                      <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                        Reviewed
                      </span>
                    ) : (
                      <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
                        Not reviewed yet
                      </span>
                    )}
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent">
                        Open PDF
                      </a>
                    )}
                    <Link
                      href={`/configurator/upload_your_contract_docs/doc${i + 1}?client=${account.id}`}
                      className="text-xs font-semibold text-accent"
                    >
                      Review &rsaquo;
                    </Link>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </details>


      <section className="mt-9">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Setup Tasks
          </h2>
          {owner && (
            <TimerButton
              accountId={account.id}
              clientId={owner.id}
              onStop={logTimedHours}
            />
          )}
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {visiblePhases.map(
            (phase) => {
              const phaseSteps = (steps ?? []).filter(
                (s) => (s.phase ?? "General") === phase,
              );
              const sections = Array.from(
                new Set(phaseSteps.map((s) => s.section)),
              );
              const completeCount = phaseSteps.filter(
                (s) => statusByStepId.get(s.id) === "approved",
              ).length;

              return (
                <details
                  key={phase}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4">
                    <h3 className="font-display text-base font-bold text-ink">
                      {phase}
                    </h3>
                    <span className="flex items-center gap-2 text-xs font-semibold text-ink-faint">
                      {(() => {
                        const starred = phaseSteps.filter((st) =>
                          requestedStepIds.has(st.id),
                        ).length;
                        return starred > 0 ? (
                          <span className="rounded-full bg-gold px-2 py-0.5 font-caption text-[10px] font-bold text-navy">
                            &#9733; {starred} requested
                          </span>
                        ) : null;
                      })()}
                      {completeCount} / {phaseSteps.length} complete
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-4">
                    {sections.map((section) => (
                      <div key={section}>
                        <h4 className="text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                          {section}
                        </h4>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {phaseSteps
                            .filter((s) => s.section === section)
                            .map((step) => {
                              const status =
                                statusByStepId.get(step.id) ?? "not_started";
                              const submission = latestSubmissionByStep.get(
                                step.id,
                              );

                              return (
                                <div
                                  key={step.id}
                                  className="rounded-lg border border-border-soft bg-bg px-3.5 py-2"
                                >
                                  <details>
                                    <summary className="flex cursor-pointer flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                      <div className="flex items-center gap-2.5">
                                        <StepOwnerIcon
                                          completedBy={step.completed_by}
                                        />
                                        <div>
                                          <div className="text-sm font-bold text-ink">
                                            {requestedStepIds.has(step.id) && (
                                              <span
                                                className="mr-1 text-gold"
                                                title="They asked our team to set this up"
                                              >
                                                &#9733;
                                              </span>
                                            )}
                                            {step.title}
                                            {purchasedStepIds.has(step.id) && (
                                              <span className="ml-2 rounded-full bg-gold/30 px-2 py-0.5 text-[10px] font-bold uppercase font-caption tracking-wide text-navy">
                                                Purchased
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <span className="flex items-center gap-2 self-start sm:self-auto">
                                      {/* Their work in a configurator, opened
                                          as they see it (changes save to
                                          their account). */}
                                      {step.step_type === "configurator" &&
                                        step.key !== "setup_initiation" && (
                                          <Link
                                            href={`/configurator/${step.key}?client=${account.id}`}
                                            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent"
                                          >
                                            Open
                                          </Link>
                                        )}
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-caption tracking-wide ${
                                          status === "approved"
                                            ? "bg-success-soft text-success"
                                            : status === "returned"
                                              ? "bg-warning-soft text-warning"
                                              : status === "submitted" ||
                                                  status === "in_progress"
                                                ? "bg-accent-soft text-accent"
                                                : "bg-border-soft text-ink-faint"
                                        }`}
                                      >
                                        {STEP_STATUS_LABEL[status].toUpperCase()}
                                      </span>
                                      </span>
                                    </summary>

                                    <div
                                      className="mt-2 pb-1 text-sm leading-relaxed text-ink-soft
                                        [&_h1]:mt-3 [&_h1]:font-display [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-ink
                                        [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-ink
                                        [&_h3]:mt-2 [&_h3]:font-bold [&_h3]:text-ink
                                        [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-ink [&_em]:italic
                                        [&_a]:font-semibold [&_a]:text-accent [&_a]:underline
                                        [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
                                        [&_li]:mt-1 first:[&>*]:mt-0"
                                    >
                                      {step.instructions ? (
                                        <ReactMarkdown>
                                          {step.instructions}
                                        </ReactMarkdown>
                                      ) : (
                                        <p className="text-ink-faint">
                                          No instructions added for this step
                                          yet.
                                        </p>
                                      )}
                                    </div>
                                  </details>

                                  {submission?.specialist_feedback && (
                                    <p className="mt-2.5 rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
                                      &ldquo;{submission.specialist_feedback}
                                      &rdquo;
                                    </p>
                                  )}

                                  {(effectiveOwner(step.completed_by, ownershipPlan) ===
                                    "staff" ||
                                    purchasedStepIds.has(step.id)) &&
                                    status !== "approved" &&
                                    owner && (
                                      <form
                                        action={markStaffStepComplete}
                                        className="mt-3"
                                      >
                                        <input
                                          type="hidden"
                                          name="client_id"
                                          value={owner.id}
                                        />
                                        <input
                                          type="hidden"
                                          name="step_id"
                                          value={step.id}
                                        />
                                        <button
                                          type="submit"
                                          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white"
                                        >
                                          Mark Complete
                                        </button>
                                      </form>
                                    )}

                                  {status === "submitted" &&
                                    submission &&
                                    owner && (
                                      <>
                                        <form
                                          action={approveSubmission}
                                          className="mt-3 inline-block"
                                        >
                                          <input
                                            type="hidden"
                                            name="submission_id"
                                            value={submission.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="client_id"
                                            value={owner.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="step_id"
                                            value={step.id}
                                          />
                                          <button
                                            type="submit"
                                            className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white"
                                          >
                                            Approve
                                          </button>
                                        </form>

                                        <form
                                          action={returnSubmission}
                                          className="mt-3 flex flex-col items-stretch gap-3 border-t border-border-soft pt-3 sm:flex-row sm:items-end"
                                        >
                                          <input
                                            type="hidden"
                                            name="submission_id"
                                            value={submission.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="client_id"
                                            value={owner.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="step_id"
                                            value={step.id}
                                          />
                                          <label className="flex flex-1 flex-col gap-1.5">
                                            <span className="text-xs font-medium text-ink-soft">
                                              Return with feedback
                                            </span>
                                            <textarea
                                              name="feedback"
                                              rows={2}
                                              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                                            />
                                          </label>
                                          <button
                                            type="submit"
                                            className="shrink-0 rounded-lg border border-warning/40 bg-warning-soft px-4 py-2 text-sm font-semibold text-warning"
                                          >
                                            Return
                                          </button>
                                        </form>
                                      </>
                                    )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            },
          )}
          {hiddenPhaseCount > 0 && (
            <p className="px-1 text-xs text-ink-faint">
              {hiddenPhaseCount} later pillar{hiddenPhaseCount === 1 ? "" : "s"} will show
              once they get there.
            </p>
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="font-display text-lg font-bold text-ink">Work log</h2>

        <div className="mt-3">
          <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-bg text-xs font-bold uppercase font-caption tracking-wide text-ink-faint">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Hours</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Lessons</th>
                </tr>
              </thead>
              <tbody>
                {(hoursLog ?? []).map((entry) => (
                  <tr key={entry.id} className="border-b border-border-soft last:border-0">
                    <td className="px-5 py-3 text-ink-soft">
                      {new Date(entry.logged_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      {Number(entry.hours).toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-ink">{entry.description}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {((entry.step_ids ?? []) as string[])
                        .map((sid) => stepTitleById.get(sid))
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
                {(hoursLog ?? []).length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-sm text-ink-soft" colSpan={4}>
                      No hours logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </section>
    </main>
  );
}
