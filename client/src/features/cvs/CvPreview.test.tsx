// The actual PDF rendering pipeline (CvPdfPreview: react-pdf's usePDF + pdf.js canvas decoding)
// needs a real browser and is exercised by e2e (cv-flow.spec.ts) and by the template-level
// pdf-templates/templates.test.tsx — reproducing that in jsdom would mean faking a canvas 2D
// context and a pdf.js worker, which would test the mock more than the code. What's actually
// unit-testable here, and wasn't covered anywhere, is CvPreview's own wiring: it lazy-loads that
// heavy component behind a Suspense fallback and a dedicated error boundary, both real behavior
// with real failure modes (a slow chunk load, a render crash) independent of PDF internals.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";
import type { CvContent, CvTemplate } from "../../shared/types.js";

describe("CvPreview", () => {
  it("shows the loading skeleton, then the resolved preview with the right props", async () => {
    vi.doMock("./CvPdfPreview.js", () => ({
      CvPdfPreview: ({ content, template }: { content: CvContent; template: CvTemplate }) => (
        <div>Mock preview: {template} / {content.summary}</div>
      ),
    }));
    const { CvPreview } = await import("./CvPreview.js");

    render(<CvPreview content={{ ...EMPTY_CV_CONTENT, summary: "A summary" }} template="modern" />);

    expect(screen.getByText("Loading preview…")).toBeInTheDocument();

    expect(await screen.findByText("Mock preview: modern / A summary")).toBeInTheDocument();
    expect(screen.queryByText("Loading preview…")).not.toBeInTheDocument();

    vi.doUnmock("./CvPdfPreview.js");
    vi.resetModules();
  });

  it("catches a crash from the preview itself via the error boundary instead of taking down the page", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.doMock("./CvPdfPreview.js", () => ({
      CvPdfPreview: (): never => {
        throw new Error("rendering exploded");
      },
    }));
    const { CvPreview } = await import("./CvPreview.js");

    render(<CvPreview content={EMPTY_CV_CONTENT} template="classic" />);

    expect(await screen.findByText(/Couldn't render the live preview/)).toBeInTheDocument();

    consoleSpy.mockRestore();
    vi.doUnmock("./CvPdfPreview.js");
    vi.resetModules();
  });
});
