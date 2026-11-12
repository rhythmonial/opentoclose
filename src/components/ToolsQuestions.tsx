"use client";

import { useState } from "react";

const ESIGN_PLATFORMS = [
  "DocuSign",
  "Dotloop",
  "Authentisign",
  "SkySlope DigiSign",
  "zipForm / Lone Wolf Transact",
  "Adobe Sign",
];

const EMAIL_PROVIDERS = [
  "Google Workspace",
  "Google (Gmail)",
  "Outlook",
  "Other",
];

const controlClass =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent";
const compactControlClass =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// compact: the smaller labels and inputs of the Profile page.
export function ToolsQuestions({
  defaultEsign,
  defaultEsignOther,
  defaultTms,
  defaultEmailProvider,
  showTms = true,
  compact = false,
}: {
  defaultEsign: string;
  defaultEsignOther: string;
  defaultTms: string;
  defaultEmailProvider: string;
  showTms?: boolean;
  compact?: boolean;
}) {
  const [esign, setEsign] = useState(defaultEsign);
  const control = compact ? compactControlClass : controlClass;
  const labelText = compact ? "text-xs font-medium text-ink-soft" : "text-sm font-medium text-ink";

  return (
    <>
      {showTms && (
      <label className="flex flex-col gap-1.5">
        <span className={labelText}>
          Transaction Management Software
        </span>
        <input
          name="tms"
          required
          defaultValue={defaultTms}
          placeholder="e.g. Open to Close, AFrame, TcDocs"
          className={control}
        />
      </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className={labelText}>Email Provider</span>
        <select
          name="email_provider"
          required
          defaultValue={
            // Earlier answers used plain "Google".
            defaultEmailProvider === "Google"
              ? "Google (Gmail)"
              : defaultEmailProvider
          }
          className={control}
        >
          <option value="" disabled>
            Select one
          </option>
          {EMAIL_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelText}>E-sign Platform</span>
        <select
          name="esign_platform"
          required
          value={esign}
          onChange={(e) => setEsign(e.target.value)}
          className={control}
        >
          <option value="" disabled>
            Select one
          </option>
          {ESIGN_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
      </label>
      {esign === "Other" && (
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>
            Other E-sign Platform
          </span>
          <input
            name="esign_other"
            required
            defaultValue={defaultEsignOther}
            className={control}
          />
        </label>
      )}
    </>
  );
}
