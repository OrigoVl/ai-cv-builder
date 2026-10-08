import { useEffect, useRef, useState } from "react";
import { usePDF } from "@react-pdf/renderer";
import * as pdfjsLib from "pdfjs-dist";
// Vite's `?url` suffix gives us a hashed, served URL for the worker file instead of inlining it —
// pdf.js insists on running its parsing/decoding off the main thread in a real Worker.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useDebouncedValue } from "../../shared/use-debounced-value.js";
import { ClassicTemplate } from "./pdf-templates/classic.js";
import { ModernTemplate } from "./pdf-templates/modern.js";
import type { CvContent, CvTemplate } from "../../shared/types.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const TEMPLATES = { classic: ClassicTemplate, modern: ModernTemplate };
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2;

/**
 * The real, downloadable PDF, rendered live in the browser — not a second HTML approximation of
 * it (a previous version was exactly that, and always looked subtly different from the real
 * download). `usePDF` runs react-pdf's actual layout/render engine (the same one the server uses
 * for the real download) against the exact template component from pdf-templates/, producing a
 * Blob; pdf.js then decodes that blob and paints each page onto a <canvas> we control, giving a
 * crisp, zoomable, genuinely multi-page-aware preview with our own UI instead of delegating to
 * the browser's native PDF plugin (tried first — works for a real user, but is a black box that
 * headless/automated screenshots can't composite, isn't stylable to match the rest of the app,
 * and varies across browsers; this version works identically everywhere since pdf.js does 100%
 * of the rendering itself, onto plain canvas elements).
 *
 * Debounced (not re-rendered per keystroke): regenerating a PDF re-runs react-pdf's full layout
 * engine, which is real work — doing that on every keystroke would be janky.
 */
export function CvPdfPreview({ content, template }: { content: CvContent; template: CvTemplate }) {
  const debouncedContent = useDebouncedValue(content, 500);
  const Template = TEMPLATES[template];
  const [instance, updateDocument] = usePDF({ document: <Template content={debouncedContent} /> });

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [rendering, setRendering] = useState(true);

  // usePDF's `document` option only seeds the FIRST render — react-pdf's hook does not itself
  // watch for the element changing on subsequent renders (confirmed by actually switching
  // templates in the browser: content edits flowed through fine, since those happen to also
  // retrigger via other state, but a template switch silently kept rendering the old layout).
  // `updateDocument` is the documented way to push a new document in; calling it here, keyed off
  // both the content and which template function is active, is what makes both kinds of change
  // actually regenerate the preview.
  useEffect(() => {
    updateDocument(<Template content={debouncedContent} />);
  }, [debouncedContent, Template, updateDocument]);

  useEffect(() => {
    let cancelled = false;

    async function renderPages() {
      const container = containerRef.current;
      const scrollEl = scrollRef.current;
      if (!instance.blob || !container || !scrollEl) return;

      setRendering(true);
      const buffer = await instance.blob.arrayBuffer();
      if (cancelled) return;
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      if (cancelled) return;

      // Fit-to-width: scale page 1 so it exactly fills the scroll container, then apply the
      // user's zoom on top — same "100% = fits the panel" baseline every PDF viewer uses.
      const firstPage = await doc.getPage(1);
      const nativeWidth = firstPage.getViewport({ scale: 1 }).width;
      const fitScale = (scrollEl.clientWidth - 32) / nativeWidth; // minus the panel's own padding
      const dpr = window.devicePixelRatio || 1;

      container.replaceChildren();
      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelled) return;
        const page = i === 1 ? firstPage : await doc.getPage(i);
        const viewport = page.getViewport({ scale: fitScale * zoom * dpr });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        canvas.className = "mb-3 rounded-sm bg-white shadow-sm";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      }

      if (!cancelled) {
        setPageCount(doc.numPages);
        setRendering(false);
      }
    }

    renderPages();
    return () => {
      cancelled = true;
    };
  }, [instance.blob, zoom]);

  return (
    <div className="flex h-[75vh] min-h-[560px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-3 py-2">
        <span className="text-xs text-gray-500">
          {pageCount > 0 ? `${pageCount} page${pageCount > 1 ? "s" : ""}` : instance.error ? "Error" : "Rendering…"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-gray-500">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto bg-gray-100 px-4 py-4">
        {instance.error ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-gray-500">
            <p>Couldn't render the preview.</p>
            <p className="text-xs text-gray-400">Your edits are still saved.</p>
          </div>
        ) : (
          <div ref={containerRef} className="flex flex-col items-center" />
        )}
        {rendering && !instance.error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-100/60">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
