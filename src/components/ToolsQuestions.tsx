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

export function ToolsQuestions({
  defaultEsign,
  defaultEsignOther,
  defaultTms,
  defaultEmailProvider,
}: {
  defaultEsign: string;
  defaultEsignOther: string;
  defaultTms: string;
  defaultEmailProvider: string;
}) {
  const [esign, setEsign] = useState(defaultEsign);

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">
          Transaction management software
        </span>
        <input
          name="tms"
          required
          defaultValue={defaultTms}
          placeholder="e.g. Open to Close, AFrame, TcDocs"
          className={controlClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Email provider</span>
        <select
          name="email_provider"
          required
          defaultValue={
            // Earlier answers used plain "Google".
            defaultEmailProvider === "Google"
              ? "Google (Gmail)"
              : defaultEmailProvider
          }
          className={controlClass}
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
        <span className="text-sm font-medium text-ink">
          Which e-sign platform do you use?
        </span>
        <select
          name="esign_platform"
          required
          value={esign}
          onChange={(e) => setEsign(e.target.value)}
          className={controlClass}
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
      {esign === "Other" ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">
            Which e-sign platform?
          </span>
          <input
            name="esign_other"
            required
            defaultValue={defaultEsignOther}
            className={controlClass}
          />
        </label>
      ) : (
        <div className="hidden sm:block" />
      )}
    </>
  );
}
