import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/query-test-utils.js";
import { CvListPage } from "./CvListPage.js";
import type { Cv } from "../../shared/types.js";

function makeCv(overrides: Partial<Cv> = {}): Cv {
  return {
    id: "cv-1",
    userId: "user-1",
    title: "Backend CV",
    targetRole: "Engineer",
    sourceKind: "text",
    status: "ready",
    error: null,
    content: null,
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

describe("CvListPage", () => {
  const originalFetch = global.fetch;
  const originalConfirm = global.confirm;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  it("shows the empty-state guide when there are no CVs yet", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cvs: [] }));
    renderWithProviders(<CvListPage />);

    expect(await screen.findByText("How it works")).toBeInTheDocument();
    expect(screen.getByText("Let's build your first one.")).toBeInTheDocument();
  });

  it("renders a row per CV with its title, role, and status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ cvs: [makeCv({ title: "Backend CV", targetRole: "Engineer", status: "generating" })] }),
    );
    renderWithProviders(<CvListPage />);

    expect(await screen.findByText("Backend CV")).toBeInTheDocument();
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.getByText("Generating…")).toBeInTheDocument();
    expect(screen.queryByText("How it works")).not.toBeInTheDocument();
  });

  it("shows an error message when the list fails to load", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 500 }));
    renderWithProviders(<CvListPage />);

    expect(await screen.findByText("Could not load your CVs.")).toBeInTheDocument();
  });

  it("deletes a CV when the user confirms the prompt", async () => {
    const user = userEvent.setup();
    global.confirm = vi.fn().mockReturnValue(true);
    // The DELETE invalidates the list query, which refetches — keep returning a valid list body
    // for every GET so that refetch doesn't itself warn about an undefined query result.
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : jsonResponse({ cvs: [makeCv({ title: "Backend CV" })] }),
    );
    renderWithProviders(<CvListPage />);

    await screen.findByText("Backend CV");
    await user.click(screen.getByRole("button", { name: "Delete Backend CV" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/cvs/cv-1", expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("does not delete when the user cancels the confirm prompt", async () => {
    const user = userEvent.setup();
    global.confirm = vi.fn().mockReturnValue(false);
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cvs: [makeCv({ title: "Backend CV" })] }));
    renderWithProviders(<CvListPage />);

    await screen.findByText("Backend CV");
    const callsBeforeClick = vi.mocked(fetch).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Delete Backend CV" }));

    expect(fetch).toHaveBeenCalledTimes(callsBeforeClick);
  });
});
