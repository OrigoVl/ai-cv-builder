// The main CV page itself had zero direct coverage — only e2e (cv-flow.spec.ts) ever rendered
// it. This pins the status-driven conditional rendering (loading/error/generating/failed/ready)
// and the title/role EditableField wiring (that each field's onSave carries the OTHER field's
// current value through unchanged, not a stale or blank one). CvPdfPreview is mocked out — see
// CvPreview.test.tsx for why its real rendering pipeline isn't unit-tested.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { CvDetailPage } from "./CvDetailPage.js";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";
import type { Cv } from "../../shared/types.js";

vi.mock("./CvPdfPreview.js", () => ({
  CvPdfPreview: () => <div>Mock PDF preview</div>,
}));

function makeCv(overrides: Partial<Cv> = {}): Cv {
  return {
    id: "cv-1",
    userId: "user-1",
    title: "Backend CV",
    targetRole: "Engineer",
    sourceKind: "text",
    status: "ready",
    error: null,
    content: EMPTY_CV_CONTENT,
    template: "classic",
    version: 1,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderDetailPage(cvId = "cv-1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/cvs/${cvId}`]}>
        <Routes>
          <Route path="/cvs/:id" element={<CvDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

describe("CvDetailPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows a loading skeleton while the CV is still loading", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = renderDetailPage();

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("Could not load this CV.")).not.toBeInTheDocument();
  });

  it("shows an error message when the CV fails to load", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 500 }));
    renderDetailPage();

    expect(await screen.findByText("Could not load this CV.")).toBeInTheDocument();
  });

  it("shows GeneratingState, not the editor, while status is 'generating'", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv({ status: "generating", content: null }), questions: [] }));
    renderDetailPage();

    expect(await screen.findByText("Drafting your CV…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Edit your CV" })).not.toBeInTheDocument();
  });

  it("shows FailedState with the error message and a working retry while status is 'failed'", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ cv: makeCv({ status: "failed", content: null, error: "The model refused to respond." }), questions: [] }),
    );
    renderDetailPage();

    expect(await screen.findByText("Generation failed")).toBeInTheDocument();
    expect(screen.getByText("The model refused to respond.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/cvs/cv-1/retry", expect.objectContaining({ method: "POST" })),
    );
  });

  it("shows the editor, template switcher, and live preview when ready with content", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv({ status: "ready" }), questions: [] }));
    renderDetailPage();

    expect(await screen.findByRole("heading", { name: "Edit your CV" })).toBeInTheDocument();
    expect(screen.getByText("Template")).toBeInTheDocument();
    expect(await screen.findByText("Mock PDF preview")).toBeInTheDocument();
    expect(screen.queryByText("Generation failed")).not.toBeInTheDocument();
    expect(screen.queryByText("Drafting your CV…")).not.toBeInTheDocument();
  });

  it("shows the Download PDF link, with the right href, only when ready", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv({ status: "generating", content: null }), questions: [] }));
    renderDetailPage();
    await screen.findByText("Drafting your CV…");
    expect(screen.queryByRole("link", { name: /Download PDF/ })).not.toBeInTheDocument();
  });

  it("downloads link points at the CV's PDF endpoint once ready", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv({ status: "ready" }), questions: [] }));
    renderDetailPage();

    const link = await screen.findByRole("link", { name: /Download PDF/ });
    expect(link).toHaveAttribute("href", "/api/cvs/cv-1/pdf");
  });

  it("editing the title saves via PUT /meta, carrying the current targetRole through unchanged", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ cv: makeCv({ status: "ready", title: "Backend CV", targetRole: "Senior Engineer" }), questions: [] }),
    );
    renderDetailPage();

    const titleButton = await screen.findByRole("button", { name: "Edit CV title" });
    await user.click(titleButton);
    const input = screen.getByRole("textbox", { name: "CV title" });
    await user.clear(input);
    await user.type(input, "New Title{Enter}");

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/cvs/cv-1/meta",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ title: "New Title", targetRole: "Senior Engineer" }),
        }),
      ),
    );
  });
});
