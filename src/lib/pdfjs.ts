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
  return pdfjs.getDocument(
    typeof data === "string" ? { url: data } : { data: new Uint8Array(data.slice(0)) },
  ).promise;
}
