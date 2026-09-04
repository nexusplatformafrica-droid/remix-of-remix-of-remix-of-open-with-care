import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { TICKET_PDF_EVENT, type TicketPdfEventDetail } from "@/lib/ticket-pdf";

/**
 * Floating ticket viewer. Ticket PDFs are rendered in-app instead of a new tab —
 * `openTicketPdf` dispatches a window event that this overlay listens for.
 *
 * Mobile browsers refuse to display a PDF inside an iframe, so the document is
 * rasterised page by page with pdf.js and drawn into the scroll area. That works
 * identically on phones and desktops; the Save button still gives the real file.
 */
export function TicketPdfFloat() {
  const [doc, setDoc] = useState<TicketPdfEventDetail | null>(null);
  const [rendering, setRendering] = useState(false);
  const [failed, setFailed] = useState(false);
  const pagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPdf = (e: Event) => {
      const detail = (e as CustomEvent<TicketPdfEventDetail>).detail;
      setDoc((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return detail;
      });
    };
    window.addEventListener(TICKET_PDF_EVENT, onPdf as EventListener);
    return () => window.removeEventListener(TICKET_PDF_EVENT, onPdf as EventListener);
  }, []);

  const close = () => {
    setDoc((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  // Rasterise the ticket so it displays on every device, phones included.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setRendering(true);
    setFailed(false);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        const data = await (await fetch(doc.url)).arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        const host = pagesRef.current;
        if (!host) return;
        host.replaceChildren();

        const width = Math.min(host.clientWidth || 420, 900);
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "block w-full rounded-lg shadow-sm";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          host.appendChild(canvas);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (!doc) return null;

  const tone =
    doc.status === "lost" ? "text-xb-red" : doc.status === "pending" ? "text-xb-text-muted" : "text-xb-green";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ticket preview"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 font-xb"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-xb-panel shadow-2xl ring-1 ring-xb-line"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-xb-line px-3 py-2">
          <h2 className="min-w-0 flex-1 truncate text-[12px] font-black uppercase tracking-wide text-xb-text">
            {doc.title}
          </h2>
          <span className={`shrink-0 text-[11px] font-black uppercase ${tone}`}>{doc.status}</span>
          <a
            href={doc.url}
            download={doc.name}
            className="flex h-7 items-center gap-1 rounded-full bg-xb-blue px-2.5 text-[10px] font-bold text-xb-on-dark hover:opacity-90"
          >
            <Download className="h-3 w-3" />
            Save
          </a>
          <button
            type="button"
            onClick={close}
            aria-label="Close ticket preview"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-xb-odds text-xb-text hover:bg-xb-odds-hover"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-xb-panel-alt p-2">
          {rendering && (
            <p className="py-10 text-center text-[12px] text-xb-text-muted">Preparing your ticket…</p>
          )}
          {failed && !rendering && (
            <p className="py-10 text-center text-[12px] text-xb-text-muted">
              Preview unavailable — tap Save to open the ticket file.
            </p>
          )}
          <div ref={pagesRef} className="space-y-2" />
        </div>
      </div>
    </div>
  );
}
