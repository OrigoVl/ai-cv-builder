import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

const { signUpEmail, useSessionMock, navigateMock } = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  useSessionMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("../../shared/auth-client.js", () => ({
  signUp: { email: signUpEmail },
  useSession: useSessionMock,
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateMock,
}));

const { SignupPage } = await import("./SignupPage.js");

describe("SignupPage", () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    signUpEmail.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("submits name, email, and password via signUp.email", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: /Create account/ }));

    expect(signUpEmail).toHaveBeenCalledWith({ email: "jane@example.com", password: "hunter22", name: "Jane Doe" });
  });

  it("falls back to using the email as the name when name is left blank", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: /Create account/ }));

    expect(signUpEmail).toHaveBeenCalledWith({ email: "jane@example.com", password: "hunter22", name: "jane@example.com" });
  });

  it("shows the server's error message when sign-up fails", async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ error: { message: "Email already in use" } });
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: /Create account/ }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });

  it("navigates to '/' only once the session store reflects the new session", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: /Create account/ }));

    expect(navigateMock).not.toHaveBeenCalled();

    useSessionMock.mockReturnValue({ data: { session: { id: "s1" } }, isPending: false });
    rerender(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(navigateMock).toHaveBeenCalledWith("/");
  });
});
