import { lazy, Suspense } from "react";
import { PreviewErrorBoundary } from "../../shared/PreviewErrorBoundary.js";
import type { CvContent, CvTemplate } from "../../shared/types.js";

// Code-split: @react-pdf/renderer's browser bundle (the PDF.js-based layout/render engine) is
// substantial, and only a CV detail page ever needs it — lazy-loading it keeps it out of every
// other page's JS payload (sign-in, the CV list, settings).
const CvPdfPreview = lazy(() => import("./CvPdfPreview.js").then((m) => ({ default: m.CvPdfPreview })));

function PreviewSkeleton() {
  return (
    <div className="flex h-[75vh] min-h-[560px] animate-pulse items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-400">
      Loading preview…
    </div>
  );
}

export function CvPreview({ content, template }: { content: CvContent; template: CvTemplate }) {
  return (
    <div className="sticky top-20 w-full max-w-[520px]">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-500">Live preview</h2>
        <p className="text-xs text-gray-400">The exact PDF you'll download — scroll and zoom like any PDF.</p>
      </div>
      <PreviewErrorBoundary>
        <Suspense fallback={<PreviewSkeleton />}>
          <CvPdfPreview content={content} template={template} />
        </Suspense>
      </PreviewErrorBoundary>
    </div>
  );
}
