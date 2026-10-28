export type VideoSource =
  // A hosted player (YouTube, Vimeo, ...) shown in an iframe.
  | { kind: "embed"; src: string }
  // A plain video file, played with the browser's own player.
  | { kind: "file"; src: string };

const VIDEO_FILE = /\.(mp4|m4v|mov|webm|ogv|ogg)$/i;

export function getVideoSource(raw: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const path = url.pathname;

  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    const id =
      host === "youtu.be"
        ? path.slice(1).split("/")[0]
        : (url.searchParams.get("v") ??
          path.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)?.[1]);
    if (id) return { kind: "embed", src: `https://www.youtube.com/embed/${id}` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // Unlisted videos carry a privacy hash: vimeo.com/123/abc or ?h=abc.
    const match = path.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (match) {
      const hash = url.searchParams.get("h") ?? match[2];
      return {
        kind: "embed",
        src: `https://player.vimeo.com/video/${match[1]}${hash ? `?h=${hash}` : ""}`,
      };
    }
  }

  if (host === "loom.com") {
    const id = path.match(/^\/(?:share|embed)\/([a-zA-Z0-9]+)/)?.[1];
    if (id) return { kind: "embed", src: `https://www.loom.com/embed/${id}` };
  }

  if (host === "drive.google.com") {
    const id = path.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id");
    if (id) {
      return { kind: "embed", src: `https://drive.google.com/file/d/${id}/preview` };
    }
  }

  if (host.endsWith("wistia.com") || host.endsWith("wistia.net")) {
    const id = path.match(/\/(?:medias|iframe)\/([a-zA-Z0-9]+)/)?.[1];
    if (id) return { kind: "embed", src: `https://fast.wistia.net/embed/iframe/${id}` };
  }

  if (host === "share.vidyard.com" || host === "play.vidyard.com") {
    const id = path.match(/\/(?:watch\/)?([a-zA-Z0-9_-]+)/)?.[1];
    if (id) return { kind: "embed", src: `https://play.vidyard.com/${id}` };
  }

  if (host === "dropbox.com" && VIDEO_FILE.test(path)) {
    // Share links open a preview page; raw=1 serves the file itself.
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
    return { kind: "file", src: url.toString() };
  }

  if (VIDEO_FILE.test(path)) return { kind: "file", src: url.toString() };

  return null;
}
