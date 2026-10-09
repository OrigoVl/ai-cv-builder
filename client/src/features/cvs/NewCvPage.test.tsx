import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test/query-test-utils.js";
import { NewCvPage } from "./NewCvPage.js";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateMock,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("NewCvPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("disables submit until a target role and a source (file or text) are both provided", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewCvPage />);

    expect(screen.getByRole("button", { name: /Generate CV/ })).toBeDisabled();

    await user.type(screen.getByLabelText("Target role"), "Engineer");
    expect(screen.getByRole("button", { name: /Generate CV/ })).toBeDisabled(); // still no PDF

    await user.click(screen.getByRole("button", { name: /Describe yourself/ }));
    await user.type(screen.getByPlaceholderText(/Paste or write your background/), "Some background text");
    expect(screen.getByRole("button", { name: /Generate CV/ })).toBeEnabled();
  });

  it("switching to 'Describe yourself' shows the textarea instead of the PDF dropzone", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewCvPage />);

    expect(screen.getByText(/Click to upload/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Describe yourself/ }));
    expect(screen.queryByText(/Click to upload/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste or write your background/)).toBeInTheDocument();
  });

  it("submits the text-mode form and navigates to the new CV on success", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: { id: "cv-123" } }));
    renderWithProviders(<NewCvPage />);

    await user.type(screen.getByLabelText("Target role"), "Engineer");
    await user.click(screen.getByRole("button", { name: /Describe yourself/ }));
    await user.type(screen.getByPlaceholderText(/Paste or write your background/), "Some background text");
    await user.click(screen.getByRole("button", { name: /Generate CV/ }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/cvs/cv-123"));

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = init?.body as FormData;
    expect(body.get("targetRole")).toBe("Engineer");
    expect(body.get("sourceText")).toBe("Some background text");
    expect(body.get("title")).toBe("Engineer"); // falls back to targetRole when title is blank
  });

  it("shows the server's error message and does not navigate when creation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "You already have a CV generating." }, 409));
    renderWithProviders(<NewCvPage />);

    await user.type(screen.getByLabelText("Target role"), "Engineer");
    await user.click(screen.getByRole("button", { name: /Describe yourself/ }));
    await user.type(screen.getByPlaceholderText(/Paste or write your background/), "Some background text");
    await user.click(screen.getByRole("button", { name: /Generate CV/ }));

    expect(await screen.findByText("You already have a CV generating.")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("uploads a PDF file in the default (upload) mode", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: { id: "cv-123" } }));
    renderWithProviders(<NewCvPage />);

    await user.type(screen.getByLabelText("Target role"), "Engineer");
    const file = new File(["pdf bytes"], "resume.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    await user.click(screen.getByRole("button", { name: /Generate CV/ }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/cvs/cv-123"));
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = init?.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.has("sourceText")).toBe(false);
  });
});
