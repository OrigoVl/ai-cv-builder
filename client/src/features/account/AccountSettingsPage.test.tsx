// The real version of several of these flows (password change + re-sign-in, account deletion) is
// already covered end-to-end by e2e/account-settings.spec.ts — that's what caught the sign-in
// race documented elsewhere in this codebase. What's missing is fast, isolated coverage of each
// section's own branching: the error paths, the "Saved"/"Changed" indicators, and the danger-zone
// confirm/cancel flow, none of which needs a real server round trip to verify.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

const { updateUserMock, changePasswordMock, deleteUserMock, signOutMock, useSessionMock, navigateMock } = vi.hoisted(
  () => ({
    updateUserMock: vi.fn(),
    changePasswordMock: vi.fn(),
    deleteUserMock: vi.fn(),
    signOutMock: vi.fn(),
    useSessionMock: vi.fn(),
    navigateMock: vi.fn(),
  }),
);

vi.mock("../../shared/auth-client.js", () => ({
  authClient: { updateUser: updateUserMock, changePassword: changePasswordMock, deleteUser: deleteUserMock },
  signOut: signOutMock,
  useSession: useSessionMock,
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateMock,
}));

const { AccountSettingsPage } = await import("./AccountSettingsPage.js");

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSettingsPage />
    </MemoryRouter>,
  );
}

describe("AccountSettingsPage", () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: { user: { name: "Jane Doe", email: "jane@example.com" } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("profile", () => {
    it("saves the edited name and shows a confirmation", async () => {
      const user = userEvent.setup();
      updateUserMock.mockResolvedValue({ error: null });
      renderPage();

      const nameInput = screen.getByLabelText("Name");
      await user.clear(nameInput);
      await user.type(nameInput, "Jane Smith");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(updateUserMock).toHaveBeenCalledWith({ name: "Jane Smith" });
      expect(await screen.findByText("Saved")).toBeInTheDocument();
    });

    it("shows the server's error message instead of 'Saved' when the update fails", async () => {
      const user = userEvent.setup();
      updateUserMock.mockResolvedValue({ error: { message: "Name is invalid" } });
      renderPage();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Name is invalid")).toBeInTheDocument();
      expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    });
  });

  describe("password", () => {
    it("changes the password, clears the fields, and shows a confirmation", async () => {
      const user = userEvent.setup();
      changePasswordMock.mockResolvedValue({ error: null });
      renderPage();

      await user.type(screen.getByLabelText("Current password"), "oldpass123");
      await user.type(screen.getByLabelText("New password"), "newpass123");
      await user.click(screen.getByRole("button", { name: "Change password" }));

      expect(changePasswordMock).toHaveBeenCalledWith({
        currentPassword: "oldpass123",
        newPassword: "newpass123",
        revokeOtherSessions: true,
      });
      expect(await screen.findByText("Changed")).toBeInTheDocument();
      expect(screen.getByLabelText("Current password")).toHaveValue("");
      expect(screen.getByLabelText("New password")).toHaveValue("");
    });

    it("shows the server's error message when the change fails, and does not clear the fields", async () => {
      const user = userEvent.setup();
      changePasswordMock.mockResolvedValue({ error: { message: "Current password is incorrect" } });
      renderPage();

      await user.type(screen.getByLabelText("Current password"), "wrongpass");
      await user.type(screen.getByLabelText("New password"), "newpass123");
      await user.click(screen.getByRole("button", { name: "Change password" }));

      expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
      expect(screen.getByLabelText("Current password")).toHaveValue("wrongpass");
    });
  });

  describe("danger zone", () => {
    it("requires clicking through to a confirm step before anything is deleted", async () => {
      const user = userEvent.setup();
      renderPage();

      expect(screen.queryByLabelText(/Confirm your password/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Delete account" }));
      expect(screen.getByLabelText(/Confirm your password/)).toBeInTheDocument();
      expect(deleteUserMock).not.toHaveBeenCalled();
    });

    it("shows an error and does not sign out on an incorrect password", async () => {
      const user = userEvent.setup();
      deleteUserMock.mockResolvedValue({ error: { message: "Incorrect password" } });
      renderPage();

      await user.click(screen.getByRole("button", { name: "Delete account" }));
      await user.type(screen.getByLabelText(/Confirm your password/), "wrong");
      await user.click(screen.getByRole("button", { name: "Permanently delete" }));

      expect(await screen.findByText("Incorrect password")).toBeInTheDocument();
      expect(signOutMock).not.toHaveBeenCalled();
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("deletes the account, signs out, and navigates to /login on a correct password", async () => {
      const user = userEvent.setup();
      deleteUserMock.mockResolvedValue({ error: null });
      signOutMock.mockResolvedValue(undefined);
      renderPage();

      await user.click(screen.getByRole("button", { name: "Delete account" }));
      await user.type(screen.getByLabelText(/Confirm your password/), "correct-password");
      await user.click(screen.getByRole("button", { name: "Permanently delete" }));

      expect(deleteUserMock).toHaveBeenCalledWith({ password: "correct-password" });
      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/login"));
      expect(signOutMock).toHaveBeenCalled();
    });

    it("cancel hides the confirm form and clears the typed password", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole("button", { name: "Delete account" }));
      await user.type(screen.getByLabelText(/Confirm your password/), "something");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByLabelText(/Confirm your password/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Delete account" }));
      expect(screen.getByLabelText(/Confirm your password/)).toHaveValue("");
    });
  });
});
