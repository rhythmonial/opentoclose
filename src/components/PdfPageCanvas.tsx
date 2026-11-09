"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { drawPdfPage, openPdf } from "@/lib/pdfjs";

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
    // Waits for the last page to stop drawing first, so moving through
    // pages quickly can't trip over a canvas that's still busy.
    return drawPdfPage(doc, page, canvas);
  }, [doc, page]);

  return <canvas ref={ref} className="block h-auto w-full" />;
}
