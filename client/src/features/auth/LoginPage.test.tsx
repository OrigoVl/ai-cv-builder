// The navigate-off-the-session-store fix (see the comment in LoginPage.tsx) is the one piece of
// real logic here, and it was previously pinned only by e2e (account-settings.spec.ts re-signing
// in). The rerender-driven test below exercises the same race directly: navigate must fire only
// once useSession's own return value reflects a session, not merely because signIn's promise
// resolved.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

const { signInEmail, useSessionMock, navigateMock } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  useSessionMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("../../shared/auth-client.js", () => ({
  signIn: { email: signInEmail },
  useSession: useSessionMock,
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateMock,
}));

const { LoginPage } = await import("./LoginPage.js");

describe("LoginPage", () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    signInEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits the entered credentials via signIn.email", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(signInEmail).toHaveBeenCalledWith({ email: "jane@example.com", password: "hunter2" });
  });

  it("shows the server's error message when sign-in fails", async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ error: { message: "Invalid email or password" } });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("falls back to a generic message when the error has none", async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ error: {} });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByText("Could not sign in. Check your email and password.")).toBeInTheDocument();
  });

  it("does not navigate right after a successful signIn call — only once the session store itself updates", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    // signIn.email resolved, but useSession() still reports no session — must not navigate yet.
    expect(navigateMock).not.toHaveBeenCalled();

    // Now simulate the session store catching up (what a real auth state change looks like).
    useSessionMock.mockReturnValue({ data: { session: { id: "s1" } }, isPending: false });
    rerender(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(navigateMock).toHaveBeenCalledWith("/");
  });
});
