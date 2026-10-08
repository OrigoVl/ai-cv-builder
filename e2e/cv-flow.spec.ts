import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Happy path through the real UI: sign up → describe yourself as text → wait for generation →
// answer the open question → edit a field → download the PDF. Run the app with LLM_MOCK=true
// first (see README) so this needs no ANTHROPIC_API_KEY and is deterministic.
test("sign up, generate, answer a question, edit, and download a PDF", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;

  await page.goto("/signup");
  await page.locator("#name").fill("E2E Tester");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("password1234");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("link", { name: "New CV" })).toBeVisible();
  await page.getByRole("link", { name: "New CV" }).click();

  await page.locator("#targetRole").fill("Senior Backend Engineer");
  await page.getByRole("button", { name: "Describe yourself" }).click();
  await page
    .locator("#sourceText")
    .fill("Jane Doe\njane@example.com\n+1 555 123 4567\n\nBackend engineer with 5 years of experience.");
  await page.getByRole("button", { name: "Generate CV" }).click();

  // Generation page: shows the "Generating…" state, then flips to "Ready" once the worker
  // (polling every 1.5s client-side, every 1s server-side) picks the job up and finishes it.
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 20_000 });

  // Mock mode always raises a question about missing experience — answer it.
  const answerInput = page.getByPlaceholder("Your answer");
  await expect(answerInput).toBeVisible({ timeout: 10_000 });
  await answerInput.fill("Senior Backend Engineer at Acme Corp, 2019-2023");
  await page.getByRole("button", { name: "Save answer" }).click();
  await expect(answerInput).toBeHidden({ timeout: 10_000 }); // question panel clears once answered

  // The question clearing only means it was recorded — the apply_answer job that merges it into
  // the CV's content/version runs asynchronously just after. Give it a moment so the editor
  // below isn't holding a version the server has already moved past (useAnswerQuestion's second
  // refetch, in shared/queries/cvs.ts, is what actually catches this in normal use).
  await page.waitForTimeout(2000);

  // Manually edit a field and confirm autosave reports success.
  const summaryBox = page.locator("textarea").first();
  await summaryBox.fill("Backend engineer focused on reliable systems.");
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5_000 });

  // The link is target="_blank" with a Content-Disposition: attachment response — Chromium
  // turns that into a download rather than a page navigation, which Playwright surfaces as a
  // `download` event on the page that triggered it (no popup tab actually sticks around).
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).not.toBeNull();
  const bytes = await readFile(pdfPath!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});
