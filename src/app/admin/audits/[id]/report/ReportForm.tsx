"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { REPORT_AREAS, REPORT_PARTS, type AuditReport } from "@/lib/auditReport";
import { AUDIT_FEE, AUDIT_TEXT_NUMBER, formatYmd, UPSELL_HOURLY_RATE } from "@/lib/audits";
import { saveAuditReport } from "../../actions";

// Boxes while filling it in; plain text when printed (and empty parts are
// left out, so the PDF only has what was written).
function Box({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-ink outline-none [field-sizing:content] focus:border-accent print:hidden"
      />
      <div className="hidden whitespace-pre-wrap text-[13px] leading-relaxed text-ink print:block">{value}</div>
    </>
  );
}

export function ReportForm({
  id,
  name,
  team,
  auditDate,
  initialDelivered,
  videoLink,
  initial,
  initialComplete,
}: {
  id: string;
  name: string;
  team: string;
  auditDate: string;
  // Its delivered date ("Mon, Dec 7, 2026"): the day it was first printed.
  initialDelivered: string | null;
  videoLink: string | null;
  initial: AuditReport;
  initialComplete: boolean;
}) {
  const [report, setReport] = useState(initial);
  const [complete, setComplete] = useState(initialComplete);
  const [status, setStatus] = useState<"saving" | "saved" | "error" | "changed" | null>(null);
  const [delivered, setDelivered] = useState(initialDelivered);

  // Downloading the PDF delivers it: today becomes its delivered date (if
  // it hasn't one), shown here too.
  async function download() {
    if (status === "changed") await save();
    // A file download, so this page stays open.
    const link = document.createElement("a");
    link.href = `/admin/audits/${id}/report/pdf`;
    link.click();
    if (!delivered) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      setDelivered(formatYmd(today));
    }
  }

  const set = (patch: Partial<AuditReport>) => {
    setReport((r) => ({ ...r, ...patch }));
    setStatus("changed");
  };
  const setPart = (area: string, part: string, v: string) => {
    setReport((r) => ({ ...r, areas: { ...r.areas, [area]: { ...r.areas[area], [part]: v } } }));
    setStatus("changed");
  };
  async function save(nextComplete = complete) {
    setStatus("saving");
    const res = await saveAuditReport(id, report, nextComplete);
    setStatus(res.ok ? "saved" : "error");
    if (!res.ok) window.alert(res.error ?? "Couldn't save.");
  }

  const filled = (v: string) => v.trim().length > 0;
  const areaFilled = (key: string) => REPORT_PARTS.some((p) => filled(report.areas[key]?.[p.key] ?? ""));
  const H2 = "font-display text-lg font-bold text-navy";

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-8 print:bg-white print:p-0">
      {/* No page margin, so the browser leaves off its own header and footer
          (date, title, web address, page number); the report pads itself on
          every page instead. */}
      <style>{`@page { margin: 0; } @media print { body { background: white; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .report-page { padding: 0.6in; -webkit-box-decoration-break: clone; box-decoration-break: clone; } }`}</style>
      <div className="w-full max-w-3xl">
        {/* Controls (not printed). */}
        <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 bg-bg/95 px-4 py-3 backdrop-blur print:hidden">
          <Link href={`/admin/audits/${id}`} className="text-sm font-medium text-accent">
            &larr; Back to the audit
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-ink-faint">
              {status === "saving"
                ? "Saving…"
                : status === "saved"
                  ? "Saved"
                  : status === "changed"
                    ? "Unsaved changes"
                    : status === "error"
                      ? "Couldn't save"
                      : ""}
            </span>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={complete}
                onChange={(e) => {
                  setComplete(e.target.checked);
                  void save(e.target.checked);
                }}
                className="h-4 w-4"
              />
              Report is complete
            </label>
            <button
              type="button"
              onClick={() => save()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent"
            >
              Download PDF
            </button>
          </div>
        </div>

        {/* The report. */}
        <article className="report-page rounded-xl border border-border bg-surface p-6 sm:p-8 print:rounded-none print:border-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-navy pb-4">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-10 w-10 shrink-0" />
              <div>
                <div className="font-display text-lg font-bold leading-tight text-navy">OTC Setup with Josie</div>
                <div className="text-xs text-ink-faint">Rhythmonial, LLC (formerly TC Optimize)</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-navy">OTC Audit Report</div>
            </div>
          </header>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-caption text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Prepared for</dt>
              <dd className="text-ink">
                {name} <span className="text-ink-soft">({team})</span>
              </dd>
            </div>
            <div>
              <dt className="font-caption text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Audit date</dt>
              <dd className="text-ink">{auditDate}</dd>
            </div>
            <div>
              <dt className="font-caption text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Delivered</dt>
              <dd className="text-ink">{delivered ?? "When downloaded"}</dd>
            </div>
          </dl>
          {videoLink && (
            <p className="mt-3 rounded-lg bg-accent-soft/50 px-3 py-2 text-sm text-navy">
              <span className="font-semibold">Your recorded walkthrough:</span>{" "}
              <a href={videoLink} className="break-all underline">
                {videoLink}
              </a>
            </p>
          )}

          <section className={`mt-6 ${filled(report.summary) ? "" : "print:hidden"}`}>
            <h2 className={H2}>Summary</h2>
            <div className="mt-2">
              <Box value={report.summary} onChange={(v) => set({ summary: v })} placeholder="An overview of their account and what you found." />
            </div>
          </section>

          <section className={`mt-6 ${filled(report.priorities) ? "" : "print:hidden"}`}>
            <h2 className={H2}>Top priorities</h2>
            <div className="mt-2">
              <Box
                value={report.priorities}
                onChange={(v) => set({ priorities: v })}
                placeholder={"The few things to tackle first, one per line:\n- …"}
              />
            </div>
          </section>

          {REPORT_AREAS.map((a) => (
            <section key={a.key} className={`mt-6 break-inside-avoid-page ${areaFilled(a.key) ? "" : "print:hidden"}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 border-b border-border-soft pb-1">
                <h2 className={H2}>{a.label}</h2>
                <span className="text-xs text-ink-faint">{a.about}</span>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {REPORT_PARTS.map((p) => {
                  const v = report.areas[a.key]?.[p.key] ?? "";
                  return (
                    <div key={p.key} className={filled(v) ? "" : "print:hidden"}>
                      <div className="text-sm font-semibold text-ink">
                        {p.label} <span className="font-normal text-ink-faint">&middot; {p.hint}</span>
                      </div>
                      <div className="mt-1">
                        <Box value={v} onChange={(nv) => setPart(a.key, p.key, nv)} placeholder={`${p.hint} in ${a.label.toLowerCase()}…`} rows={2} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <section className={`mt-6 ${filled(report.next_steps) ? "" : "print:hidden"}`}>
            <h2 className={H2}>Next steps</h2>
            <div className="mt-2">
              <Box value={report.next_steps} onChange={(v) => set({ next_steps: v })} placeholder="What you recommend they do next." />
            </div>
          </section>

          <footer className="mt-8 rounded-lg bg-navy px-5 py-4 text-sm text-white break-inside-avoid">
            <div className="font-semibold text-gold">Want us to make these updates?</div>
            <p className="mt-1 text-white/90">
              Implementation is ${UPSELL_HOURLY_RATE}/hour, and your ${AUDIT_FEE} audit fee is credited toward it.
              Reply to this email or text {AUDIT_TEXT_NUMBER} to get started.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}
