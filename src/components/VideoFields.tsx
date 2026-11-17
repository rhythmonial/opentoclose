"use client";

import { useState } from "react";

const inputClass =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// A lesson's video URL and its thumbnail, side by side. The thumbnail is
// required once there's a video. Configurators set their video link beside
// their resource links instead (ConfiguratorVideoField); their thumbnail is
// kept here, hidden.
export function VideoFields({
  formId,
  defaultVideoUrl,
  defaultThumbnailUrl,
  active,
}: {
  formId: string;
  defaultVideoUrl: string | null;
  defaultThumbnailUrl: string | null;
  active: boolean;
}) {
  const [video, setVideo] = useState(defaultVideoUrl ?? "");

  if (!active) {
    return (
      <input type="hidden" name="video_thumbnail_url" form={formId} defaultValue={defaultThumbnailUrl ?? ""} />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Video URL</span>
        <input
          name="video_url"
          form={formId}
          value={video}
          onChange={(e) => setVideo(e.target.value)}
          placeholder="YouTube, Vimeo, Loom, Google Drive, or .mp4 link"
          className={inputClass}
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-soft">Thumbnail URL</span>
        <input
          name="video_thumbnail_url"
          form={formId}
          defaultValue={defaultThumbnailUrl ?? ""}
          required={video.trim() !== ""}
          placeholder="Image shown before the video plays"
          className={inputClass}
        />
      </label>
    </div>
  );
}

// A configurator's video link (shown by the "i" beside its title), next to
// its resource links in the lesson editor.
export function ConfiguratorVideoField({
  formId,
  defaultVideoUrl,
}: {
  formId: string;
  defaultVideoUrl: string | null;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-soft">Video link</span>
      <input
        name="video_url"
        form={formId}
        defaultValue={defaultVideoUrl ?? ""}
        placeholder="YouTube, Vimeo, Loom, Google Drive, or .mp4 link"
        className={inputClass}
      />
      <span className="text-[11px] text-ink-faint">Opens from the &ldquo;i&rdquo; beside the lesson&rsquo;s title.</span>
    </label>
  );
}
