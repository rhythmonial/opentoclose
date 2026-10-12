"use client";

import { useState } from "react";

const TOOLS = [
  "dotloop",
  "SkySlope",
  "Paperless Pipeline",
  "BrokerMint",
  "Open to Close",
  "Follow Up Boss",
  "Google Sheets / Spreadsheets",
  "None yet",
];

export function ToolsChecklist({
  defaultValues = [],
  defaultOther = "",
}: {
  defaultValues?: string[];
  defaultOther?: string;
}) {
  const [otherChecked, setOtherChecked] = useState(Boolean(defaultOther));

  return (
    <div className="flex flex-col gap-2">
      {TOOLS.map((tool) => (
        <label key={tool} className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="tools"
            value={tool}
            defaultChecked={defaultValues.includes(tool)}
            className="h-4 w-4 rounded border-border"
          />
          {tool}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={otherChecked}
          onChange={(e) => setOtherChecked(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Other
      </label>
      {otherChecked && (
        <input
          name="tools_other"
          defaultValue={defaultOther}
          placeholder="What else do you use?"
          className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
      )}
    </div>
  );
}
