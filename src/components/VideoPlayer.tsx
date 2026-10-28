"use client";

import { useState } from "react";
import type { VideoSource } from "@/lib/videoEmbed";

const frameClass =
  "aspect-video overflow-hidden rounded-xl border border-border bg-black";

// Plays a lesson or replay video in the page. With a thumbnail, hosted
// players show it as a cover and only load once it's clicked.
export function VideoPlayer({
  source,
  thumbnail,
  title,
  className = "",
}: {
  source: VideoSource;
  thumbnail?: string | null;
  title: string;
  className?: string;
}) {
  const [started, setStarted] = useState(false);

  if (source.kind === "file") {
    return (
      <div className={`${frameClass} ${className}`}>
        <video
          controls
          preload="metadata"
          playsInline
          poster={thumbnail ?? undefined}
          // Without a poster, start at 0.1s so Safari shows the first frame.
          src={thumbnail ? source.src : `${source.src}#t=0.1`}
          className="h-full w-full"
        />
      </div>
    );
  }

  if (thumbnail && !started) {
    return (
      <button
        type="button"
        onClick={() => setStarted(true)}
        aria-label={`Play ${title}`}
        className={`${frameClass} group relative block w-full ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- any host's image */}
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-navy shadow-lg transition group-hover:scale-105">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </button>
    );
  }

  const src = started
    ? `${source.src}${source.src.includes("?") ? "&" : "?"}autoplay=1`
    : source.src;

  return (
    <div className={`${frameClass} ${className}`}>
      <iframe
        src={src}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
