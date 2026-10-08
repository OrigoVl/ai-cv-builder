// This hook is the one place that owns "what's being edited right now" for both the form
// (CvEditor) and the live preview, and the one place the dirty/CAS-conflict protection against a
// background poll clobbering in-progress typing actually lives — exactly the behavior the README
// calls out as having been caught by an e2e run, not a unit test, the first time around. This
// file is what should have caught it.
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithQuery } from "../../test/query-test-utils.js";
import { useCvDraft } from "./useCvDraft.js";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";
import type { Cv } from "../../shared/types.js";

function makeCv(overrides: Partial<Cv> = {}): Cv {
  return {
    id: "cv-1",
    userId: "user-1",
    title: "Test CV",
    targetRole: "Engineer",
    sourceKind: "text",
    status: "ready",
    error: null,
    content: { ...EMPTY_CV_CONTENT, summary: "Original summary" },
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

describe("useCvDraft", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("starts with the CV's own content and an idle save state", () => {
    const cv = makeCv();
    const { result } = renderHookWithQuery(() => useCvDraft(cv));
    expect(result.current.content.summary).toBe("Original summary");
    expect(result.current.saveState).toBe("idle");
  });

  it("falls back to empty content when the CV has none yet", () => {
    const cv = makeCv({ content: null });
    const { result } = renderHookWithQuery(() => useCvDraft(cv));
    expect(result.current.content).toEqual(EMPTY_CV_CONTENT);
  });

  it("updates content immediately on patch(), before the debounced save even fires", () => {
    const cv = makeCv();
    const { result } = renderHookWithQuery(() => useCvDraft(cv));

    act(() => {
      result.current.patch({ ...result.current.content, summary: "Edited summary" });
    });

    expect(result.current.content.summary).toBe("Edited summary");
  });

  it("saves the patched content after the debounce and reports 'saved'", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv({ version: 2 }) }));
    const cv = makeCv();
    const { result } = renderHookWithQuery(() => useCvDraft(cv));

    act(() => {
      result.current.patch({ ...result.current.content, summary: "Edited summary" });
    });

    await waitFor(() => expect(result.current.saveState).toBe("saved"), { timeout: 2000 });

    expect(fetch).toHaveBeenCalledWith(
      "/api/cvs/cv-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: { ...cv.content, summary: "Edited summary" }, version: 1 }),
      }),
    );
  });

  it("reports 'conflict' (not a generic error) on a 409 from a stale version", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "stale version" }, 409));
    const cv = makeCv();
    const { result } = renderHookWithQuery(() => useCvDraft(cv));

    act(() => {
      result.current.patch({ ...result.current.content, summary: "Edited summary" });
    });

    await waitFor(() => expect(result.current.saveState).toBe("conflict"), { timeout: 2000 });
  });

  it("reports a generic 'error' (not 'conflict') for a non-409 failure", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "boom" }, 500));
    const cv = makeCv();
    const { result } = renderHookWithQuery(() => useCvDraft(cv));

    act(() => {
      result.current.patch({ ...result.current.content, summary: "Edited summary" });
    });

    await waitFor(() => expect(result.current.saveState).toBe("error"), { timeout: 2000 });
  });

  it("does NOT clobber an in-progress local edit when the server version changes underneath it", () => {
    // The exact protection a background poll (useCv's refetchInterval) depends on: without this,
    // an apply_answer job landing mid-keystroke would silently overwrite what the user just typed.
    const cv = makeCv();
    const { result, rerender } = renderHookWithQuery(({ cv }: { cv: Cv }) => useCvDraft(cv), {
      initialProps: { cv },
    });

    act(() => {
      result.current.patch({ ...result.current.content, summary: "User is mid-edit" });
    });
    expect(result.current.content.summary).toBe("User is mid-edit");

    // A newer version arrives from the server (e.g. a background poll) while still dirty.
    const newerCv = makeCv({ version: 2, content: { ...EMPTY_CV_CONTENT, summary: "Server-side change" } });
    rerender({ cv: newerCv });

    // The user's own typing must still be what's shown — not silently replaced.
    expect(result.current.content.summary).toBe("User is mid-edit");
  });

  it("DOES pick up a server-side change once no longer dirty (not stuck on stale content forever)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv({ version: 2 }) }));
    const cv = makeCv();
    const { result, rerender } = renderHookWithQuery(({ cv }: { cv: Cv }) => useCvDraft(cv), {
      initialProps: { cv },
    });

    act(() => {
      result.current.patch({ ...result.current.content, summary: "Saved edit" });
    });
    await waitFor(() => expect(result.current.saveState).toBe("saved"), { timeout: 2000 });

    // Now that the save succeeded (dirty is false again), a later server-side change should flow
    // through — e.g. a question's answer being merged in by the apply_answer job.
    const newerCv = makeCv({ version: 3, content: { ...EMPTY_CV_CONTENT, summary: "Merged from an answered question" } });
    rerender({ cv: newerCv });

    expect(result.current.content.summary).toBe("Merged from an answered question");
  });

  it("reload() clears the save state back to idle", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "stale version" }, 409));
    const cv = makeCv();
    const { result } = renderHookWithQuery(() => useCvDraft(cv));

    act(() => {
      result.current.patch({ ...result.current.content, summary: "Edited summary" });
    });
    await waitFor(() => expect(result.current.saveState).toBe("conflict"), { timeout: 2000 });

    act(() => {
      result.current.reload();
    });
    expect(result.current.saveState).toBe("idle");
  });
});
