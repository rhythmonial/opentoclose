"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { openPdf } from "@/lib/pdfjs";

// Opens a PDF from bytes or a URL for as long as the component using it is
// mounted.
export function usePdfDocument(source: ArrayBuffer | string) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    openPdf(source)
      .then((d) => {
        opened = d;
        if (cancelled) void d.loadingTask.destroy();
        else setDoc(d);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't open this PDF.");
      });
    return () => {
      cancelled = true;
      void opened?.loadingTask.destroy();
    };
  }, [source]);

  return { doc, error };
}

// One page of an open PDF, drawn sharp and scaled to its container's width.
export function PdfPageCanvas({
  doc,
  page,
}: {
  doc: PDFDocumentProxy;
  page: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // Cleanup can run before the page has loaded (or twice in dev), so a
    // flag stops a late render from drawing over a newer one.
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    doc.getPage(page).then((p) => {
      if (cancelled) return;
      // A fixed render width, since the container may not be laid out yet.
      const base = p.getViewport({ scale: 1 });
      const target = 1000 * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: target / base.width });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      task = p.render({ canvas, viewport });
      // A cancelled render rejects; that's expected.
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page]);

  return <canvas ref={ref} className="block h-auto w-full" />;
}
