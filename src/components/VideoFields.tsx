"use client";

import { useState } from "react";

const inputClass =
  "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent";

// A lesson's video URL and its thumbnail, side by side. The thumbnail is
// required once there's a video. Hidden (but kept, so nothing is lost) for
// configurators, which have no video.
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

  return (
    <div className={active ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "hidden"}>
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
          required={active && video.trim() !== ""}
          placeholder="Image shown before the video plays"
          className={inputClass}
        />
      </label>
    </div>
  );
}
