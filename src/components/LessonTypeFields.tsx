"use client";

import { useState } from "react";

const LESSON_TYPES = [
  { value: "lesson", label: "Lesson (video + resources)" },
  { value: "form", label: "Form (single link)" },
  { value: "link", label: "Link (single link)" },
  { value: "configurator", label: "Configurator (custom-built page)" },
];

export function LessonTypeFields({
  defaultType,
  defaultLinkUrl,
  defaultVideoUrl,
  stepKey,
  showVideoUrl = true,
}: {
  defaultType: string;
  defaultLinkUrl?: string | null;
  defaultVideoUrl?: string | null;
  stepKey?: string;
  showVideoUrl?: boolean;
}) {
  const [type, setType] = useState(defaultType);

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Lesson Type</span>
        <select
          name="step_type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        >
          {LESSON_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {(type === "form" || type === "link") && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Link</span>
          <input
            name="link_url"
            defaultValue={defaultLinkUrl ?? ""}
            placeholder="https://..."
            required
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
      )}

      {showVideoUrl && type === "lesson" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Video URL</span>
          <input
            name="video_url"
            defaultValue={defaultVideoUrl ?? ""}
            placeholder="https://..."
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
      )}

      {type === "configurator" && (
        <p className="flex items-center text-xs text-ink-faint">
          Opens a custom-built page at /configurator/
          {stepKey || "{key}"}. Ask your developer to build or update it
          there.
        </p>
      )}
    </>
  );
}
