"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { type AuditReport } from "@/lib/auditReport";
import { formatYmd } from "@/lib/audits";
import { saveAuditReport } from "../../actions";
import { ChecklistFields } from "./ChecklistFields";

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

  // The latest report and a count of edits, so a save sends what's on the
  // page and an edit made while it saves still gets saved after.
  const latest = useRef(report);
  const edits = useRef(0);
  const setCheck = (key: string, value: string | boolean | string[]) => {
    setReport((r) => {
      const next = { ...r, checklist: { ...r.checklist, [key]: value } };
      latest.current = next;
      return next;
    });
    edits.current += 1;
    setStatus("changed");
  };
  // Saves on its own a moment after the last change.
  useEffect(() => {
    if (status !== "changed") return;
    const t = window.setTimeout(() => void save(), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, status]);
  // `manual`: the Save button, which says why if it can't save (an autosave
  // just shows "Couldn't save" up top, so it never interrupts typing).
  async function save(nextComplete = complete, manual = false) {
    const at = edits.current;
    setStatus("saving");
    const res = await saveAuditReport(id, latest.current, nextComplete);
    if (edits.current !== at) setStatus("changed");
    else setStatus(res.ok ? "saved" : "error");
    if (!res.ok && manual) window.alert(res.error ?? "Couldn't save.");
  }


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
              onClick={() => save(complete, true)}
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

        <p className="mb-3 text-xs text-ink-faint print:hidden">
          Work through each step as you audit. Changes save on their own; text boxes take Markdown (
          <code>- bullets</code>, <code>**bold**</code>). Download PDF gives the report from what you fill in.
        </p>

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

        </article>

        <div className="mt-6">
          <ChecklistFields values={report.checklist} onChange={setCheck} />
        </div>
      </div>
    </main>
  );
}
