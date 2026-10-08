import { test, expect } from "@playwright/test";

// Covers the account settings page added after the initial design pass: updating the display
// name, changing the password (and signing in with the NEW one afterwards — not just trusting
// the success toast), and deleting the account as a final, irreversible step.

test("update profile name and change password, then sign in with the new password", async ({ page }) => {
  const email = `settings-${Date.now()}@example.test`;
  const oldPassword = "password1234";
  const newPassword = "newpassword5678";

  await page.goto("/signup");
  await page.locator("#name").fill("Original Name");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(oldPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("link", { name: "New CV" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();

  // Profile name
  const nameInput = page.locator("#account-name");
  await nameInput.fill("Updated Name");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5_000 });

  // Password change
  await page.getByLabel("Current password").fill(oldPassword);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Changed")).toBeVisible({ timeout: 5_000 });

  // Sign out and confirm the NEW password actually works.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "New CV" })).toBeVisible();
});

test("delete account requires the correct password and is irreversible", async ({ page }) => {
  const email = `delete-${Date.now()}@example.test`;
  const password = "password1234";

  await page.goto("/signup");
  await page.locator("#name").fill("To Be Deleted");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("link", { name: "New CV" })).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).click();

  // Wrong password is rejected, not silently accepted.
  await page.getByLabel("Confirm your password to delete your account").fill("totally-wrong-password");
  await page.getByRole("button", { name: "Permanently delete" }).click();
  await expect(page.getByText(/could not delete|invalid/i)).toBeVisible({ timeout: 5_000 });

  // Correct password deletes the account and signs the browser out.
  await page.getByLabel("Confirm your password to delete your account").fill(password);
  await page.getByRole("button", { name: "Permanently delete" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

  // The account genuinely no longer exists — signing in again fails.
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid|not found/i)).toBeVisible({ timeout: 5_000 });
});
