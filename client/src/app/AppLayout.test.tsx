// AppLayout's `initials()` helper isn't exported, so it's exercised here through the rendered
// avatar — covering the branches that actually matter (a full name, a single-word name, and the
// no-name email fallback) plus the sign-out flow, neither pinned by anything before now.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

const { signOutMock, useSessionMock, navigateMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  useSessionMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("../shared/auth-client.js", () => ({
  signOut: signOutMock,
  useSession: useSessionMock,
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateMock,
}));

const { AppLayout } = await import("./AppLayout.js");

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<p>Page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  beforeEach(() => {
    signOutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the routed page content via the Outlet", () => {
    useSessionMock.mockReturnValue({ data: { user: { name: "Jane Doe", email: "jane@example.com" } } });
    renderLayout();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("shows initials from a two-word name", () => {
    useSessionMock.mockReturnValue({ data: { user: { name: "Jane Doe", email: "jane@example.com" } } });
    renderLayout();
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("falls back to the first two letters of a single-word name", () => {
    useSessionMock.mockReturnValue({ data: { user: { name: "Madonna", email: "m@example.com" } } });
    renderLayout();
    expect(screen.getByText("MA")).toBeInTheDocument();
  });

  it("falls back to the email when there is no name at all", () => {
    useSessionMock.mockReturnValue({ data: { user: { name: null, email: "alice@example.com" } } });
    renderLayout();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("signs out and navigates to /login when the sign-out button is clicked", async () => {
    const user = userEvent.setup();
    useSessionMock.mockReturnValue({ data: { user: { name: "Jane Doe", email: "jane@example.com" } } });
    renderLayout();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOutMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });
});
