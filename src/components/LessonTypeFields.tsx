"use client";

import { useState } from "react";

const LESSON_TYPES = [
  { value: "lesson", label: "Lesson (video, resources & links)" },
  { value: "configurator", label: "Configurator (custom-built page)" },
];

const inputClass =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// The lesson type picker, plus the fields that go with it: a lesson's video
// (and its thumbnail, when editing), or where a configurator's page lives.
// `formId` ties the inputs to a form they don't sit inside.
export function LessonTypeFields({
  defaultType,
  defaultVideoUrl,
  defaultThumbnailUrl,
  stepKey,
  formId,
  showThumbnail = false,
}: {
  defaultType: string;
  defaultVideoUrl?: string | null;
  defaultThumbnailUrl?: string | null;
  stepKey?: string;
  formId?: string;
  showThumbnail?: boolean;
}) {
  // Older Form/Link steps were turned into configurators.
  const [type, setType] = useState(defaultType === "lesson" ? "lesson" : "configurator");

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Lesson Type</span>
        <select
          name="step_type"
          form={formId}
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputClass}
        >
          {LESSON_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {type === "lesson" ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-soft">Video URL</span>
            <input
              name="video_url"
              form={formId}
              defaultValue={defaultVideoUrl ?? ""}
              placeholder="YouTube, Vimeo, Loom, Google Drive, or .mp4 link"
              className={inputClass}
            />
          </label>
          {showThumbnail && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-soft">
                Video thumbnail URL (optional)
              </span>
              <input
                name="video_thumbnail_url"
                form={formId}
                defaultValue={defaultThumbnailUrl ?? ""}
                placeholder="Image link shown before the video plays"
                className={inputClass}
              />
            </label>
          )}
        </>
      ) : (
        <p className="text-xs text-ink-faint">
          {stepKey === "setup_initiation"
            ? "Opens the Setup Initiation form at /setup."
            : `Opens a custom-built page at /configurator/${stepKey || "{key}"}. Ask your developer to build or update it there.`}
        </p>
      )}
    </div>
  );
}
