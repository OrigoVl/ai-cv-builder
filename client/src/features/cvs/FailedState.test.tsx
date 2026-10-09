import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../../test/query-test-utils.js";
import { FailedState } from "./FailedState.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("FailedState", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows the server's error message when one is given", () => {
    renderWithQuery(<FailedState cvId="cv-1" error="The model refused to respond." />);
    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(screen.getByText("The model refused to respond.")).toBeInTheDocument();
  });

  it("omits the detail line when there is no error message", () => {
    renderWithQuery(<FailedState cvId="cv-1" error={null} />);
    expect(screen.getByText("Generation failed")).toBeInTheDocument();
  });

  it("clicking 'Try again' POSTs a retry for this CV", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: { id: "cv-1", status: "generating" } }));
    renderWithQuery(<FailedState cvId="cv-1" error="boom" />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/cvs/cv-1/retry", expect.objectContaining({ method: "POST" })),
    );
  });

  it("disables the retry button while the retry is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (res: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    renderWithQuery(<FailedState cvId="cv-1" error="boom" />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();

    resolveFetch(jsonResponse({ cv: { id: "cv-1", status: "generating" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).not.toBeDisabled());
  });
});
