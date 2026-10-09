import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../../test/query-test-utils.js";
import { TemplateSwitcher } from "./TemplateSwitcher.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("TemplateSwitcher", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("marks the current template as checked and the other as not", () => {
    renderWithQuery(<TemplateSwitcher cvId="cv-1" current="classic" />);

    expect(screen.getByRole("radio", { name: "Classic" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Modern" })).toHaveAttribute("aria-checked", "false");
  });

  it("switching to the other template PUTs it to the server", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ cv: { id: "cv-1", template: "modern" } }),
    );
    renderWithQuery(<TemplateSwitcher cvId="cv-1" current="classic" />);

    await user.click(screen.getByRole("radio", { name: "Modern" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/cvs/cv-1/template",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ template: "modern" }) }),
      ),
    );
  });

  it("clicking the already-active template does not call the API", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: { id: "cv-1", template: "classic" } }));
    renderWithQuery(<TemplateSwitcher cvId="cv-1" current="classic" />);

    await user.click(screen.getByRole("radio", { name: "Classic" }));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables both options while the switch is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (res: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    renderWithQuery(<TemplateSwitcher cvId="cv-1" current="classic" />);

    await user.click(screen.getByRole("radio", { name: "Modern" }));

    expect(screen.getByRole("radio", { name: "Classic" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Modern" })).toBeDisabled();

    resolveFetch(jsonResponse({ cv: { id: "cv-1", template: "modern" } }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Classic" })).not.toBeDisabled());
  });
});
