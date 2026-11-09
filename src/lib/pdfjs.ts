// Browser-only loader for pdf.js, so it stays out of the server bundle and
// out of pages that never open a PDF. Uses the legacy build: the modern one
// needs JavaScript features many browsers (including current Safari) lack.
let loading: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

export function loadPdfjs() {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return loading;
}

// Opens a PDF from bytes or a URL. Bytes are copied, because pdf.js hands
// its buffer to the worker and the caller may want to open it again.
export async function openPdf(data: ArrayBuffer | string) {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({
    ...(typeof data === "string" ? { url: data } : { data: new Uint8Array(data.slice(0)) }),
    // Exposes font names, so symbol-font checkboxes can be recognized.
    fontExtraProperties: true,
  }).promise;
}

type RenderTask = { cancel: () => void; promise: Promise<void> };
type PageLike = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvas: HTMLCanvasElement; viewport: unknown }) => RenderTask;
};
type DocLike = { getPage: (n: number) => Promise<unknown> };

// What's being drawn on each canvas, so a new page waits for the last one
// to stop: pdf.js refuses to draw on a canvas that's still busy, which is
// what clicking through pages quickly used to run into.
const drawing = new WeakMap<HTMLCanvasElement, { task: RenderTask | null; done: Promise<void> }>();

// Draws one page of an open PDF on a canvas, sharp, at a fixed width that
// CSS scales to fit (the container may not be laid out yet). Calls onSize
// with the page's size in points. Never throws; returns a cancel function.
export function drawPdfPage(
  doc: DocLike,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  onSize?: (size: { width: number; height: number }) => void,
): () => void {
  let cancelled = false;
  const previous = drawing.get(canvas);
  previous?.task?.cancel();
  const entry: { task: RenderTask | null; done: Promise<void> } = {
    task: null,
    done: Promise.resolve(),
  };
  entry.done = (async () => {
    await previous?.done.catch(() => {});
    if (cancelled) return;
    const page = (await doc.getPage(pageNumber)) as PageLike;
    if (cancelled) return;
    const base = page.getViewport({ scale: 1 });
    const target = 1000 * Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: target / base.width });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    onSize?.({ width: base.width, height: base.height });
    entry.task = page.render({ canvas, viewport });
    await entry.task.promise;
  })().catch(() => {
    // A cancelled render rejects; that's expected.
  });
  drawing.set(canvas, entry);
  return () => {
    cancelled = true;
    entry.task?.cancel();
  };
}
