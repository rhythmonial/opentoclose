"use client";

import { useEffect, useRef, useState } from "react";
import { getVideoSource } from "@/lib/videoEmbed";
import { VideoPlayer } from "@/components/VideoPlayer";

// The "i" beside a lesson's title: opens the lesson's video in a popup under
// it. Collapsing pauses it and keeps it loaded, so opening it again picks up
// where they left off.
export function LessonVideoButton({
  url,
  thumbnail,
  title,
}: {
  url: string | null | undefined;
  thumbnail?: string | null;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  // Loaded the first time it's opened, then kept.
  const [loaded, setLoaded] = useState(false);
  const panel = useRef<HTMLSpanElement>(null);
  const source = url ? getVideoSource(url) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!source) return null;

  // Pauses the video: a video file directly; YouTube and Vimeo players by
  // message.
  function pause() {
    const root = panel.current;
    root?.querySelector("video")?.pause();
    const frame = root?.querySelector("iframe");
    const win = frame?.contentWindow;
    if (!frame || !win) return;
    if (frame.src.includes("youtube.com")) {
      win.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
    } else if (frame.src.includes("vimeo.com")) {
      win.postMessage(JSON.stringify({ method: "pause" }), "*");
    }
  }

  function collapse() {
    pause();
    setOpen(false);
  }

  return (
    <span className="relative ml-2 inline-flex align-middle">
      <button
        type="button"
        onClick={() => {
          setLoaded(true);
          if (open) collapse();
          else setOpen(true);
        }}
        aria-expanded={open}
        aria-label={open ? "Collapse the lesson video" : "Watch the lesson video"}
        title={open ? "Collapse the video" : "Watch the lesson video"}
        className={`flex h-6 w-6 items-center justify-center rounded-full border font-serif text-sm font-bold italic leading-none ${
          open ? "border-accent bg-accent text-white" : "border-accent/50 text-accent hover:bg-accent-soft"
        }`}
      >
        i
      </button>
      {loaded && (
        <span
          ref={panel}
          role="dialog"
          aria-label={`${title} video`}
          className={
            open
              ? "absolute left-0 top-full z-40 mt-2 block w-[min(40rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-3 font-sans text-sm font-normal not-italic shadow-xl"
              : "hidden"
          }
        >
          <span className="mb-2 flex items-center justify-between gap-3">
            <span className="truncate font-semibold text-ink">{title}</span>
            <button
              type="button"
              onClick={collapse}
              className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Collapse
            </button>
          </span>
          <VideoPlayer source={source} thumbnail={thumbnail} title={title} />
        </span>
      )}
    </span>
  );
}
