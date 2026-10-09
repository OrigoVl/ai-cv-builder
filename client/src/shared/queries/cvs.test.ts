// The TanStack Query hooks every CV page is built on — until now only exercised indirectly
// through page-level e2e runs. Each hook's job here is narrow and worth pinning directly: which
// URL/method it hits, what it does to the cache on success (setQueryData vs invalidateQueries,
// and which key), and — for useCreateCv — the file-vs-text FormData branching.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithQuery } from "../../test/query-test-utils.js";
import { cvKeys } from "./keys.js";
import {
  useAnswerQuestion,
  useCreateCv,
  useCv,
  useCvs,
  useDeleteCv,
  useDismissQuestion,
  useRetryCv,
  useUpdateCv,
  useUpdateCvMeta,
  useUpdateTemplate,
  type CvDetail,
} from "./cvs.js";
import type { Cv } from "../types.js";

function makeCv(overrides: Partial<Cv> = {}): Cv {
  return {
    id: "cv-1",
    userId: "user-1",
    title: "Test CV",
    targetRole: "Engineer",
    sourceKind: "text",
    status: "ready",
    error: null,
    content: null,
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

describe("cvs queries", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("useCvs", () => {
    it("fetches the CV list", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ cvs: [makeCv()] }));
      const { result } = renderHookWithQuery(() => useCvs());

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(fetch).toHaveBeenCalledWith("/api/cvs", expect.anything());
      expect(result.current.data?.cvs).toHaveLength(1);
    });
  });

  describe("useCv", () => {
    it("fetches a CV by id", async () => {
      const detail: CvDetail = { cv: makeCv(), questions: [] };
      vi.mocked(fetch).mockResolvedValue(jsonResponse(detail));
      const { result } = renderHookWithQuery(() => useCv("cv-1"));

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(fetch).toHaveBeenCalledWith("/api/cvs/cv-1", expect.anything());
    });

    it("does not fetch when id is undefined", () => {
      renderHookWithQuery(() => useCv(undefined));
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("useCreateCv", () => {
    it("submits a PDF upload as FormData with the file field set", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv() }));
      const { result, queryClient } = renderHookWithQuery(() => useCreateCv());
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      const file = new File(["pdf bytes"], "resume.pdf", { type: "application/pdf" });

      await result.current.mutateAsync({ title: "My CV", targetRole: "Engineer", file });

      const [, init] = vi.mocked(fetch).mock.calls[0]!;
      const body = init?.body as FormData;
      expect(body.get("title")).toBe("My CV");
      expect(body.get("targetRole")).toBe("Engineer");
      expect(body.get("file")).toBe(file);
      expect(body.has("sourceText")).toBe(false);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cvKeys.list });
    });

    it("submits free text as FormData with the sourceText field set, no file", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv() }));
      const { result } = renderHookWithQuery(() => useCreateCv());

      await result.current.mutateAsync({ title: "My CV", targetRole: "Engineer", sourceText: "Jane Doe, engineer." });

      const [, init] = vi.mocked(fetch).mock.calls[0]!;
      const body = init?.body as FormData;
      expect(body.get("sourceText")).toBe("Jane Doe, engineer.");
      expect(body.has("file")).toBe(false);
    });
  });

  describe("useUpdateCv", () => {
    it("PUTs content+version and writes the returned cv into the detail cache", async () => {
      const updated = makeCv({ version: 2 });
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: updated }));
      const { result, queryClient } = renderHookWithQuery(() => useUpdateCv("cv-1"));
      queryClient.setQueryData<CvDetail>(cvKeys.detail("cv-1"), { cv: makeCv({ version: 1 }), questions: [] });

      await result.current.mutateAsync({ content: { contact: { name: "", email: "", phone: "", location: "", links: [] }, summary: "", experience: [], education: [], skills: [] }, version: 1 });

      const [, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(init?.method).toBe("PUT");
      expect(queryClient.getQueryData<CvDetail>(cvKeys.detail("cv-1"))?.cv).toEqual(updated);
    });
  });

  describe("useDeleteCv", () => {
    it("DELETEs the CV and invalidates the list", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
      const { result, queryClient } = renderHookWithQuery(() => useDeleteCv());
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      await result.current.mutateAsync("cv-1");

      const [, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(init?.method).toBe("DELETE");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cvKeys.list });
    });
  });

  describe("useRetryCv", () => {
    it("POSTs /retry and invalidates that CV's detail query", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: makeCv({ status: "generating" }) }));
      const { result, queryClient } = renderHookWithQuery(() => useRetryCv("cv-1"));
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      await result.current.mutateAsync();

      expect(fetch).toHaveBeenCalledWith("/api/cvs/cv-1/retry", expect.objectContaining({ method: "POST" }));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cvKeys.detail("cv-1") });
    });
  });

  describe("useAnswerQuestion", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("invalidates immediately, then again ~1.5s later to catch the async merge job", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
      const { result, queryClient } = renderHookWithQuery(() => useAnswerQuestion("cv-1"));
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      await result.current.mutateAsync({ questionId: "q1", answer: "jane@example.com" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/cvs/cv-1/questions/q1/answer",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ answer: "jane@example.com" }) }),
      );
      expect(invalidateSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1500);
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cvKeys.detail("cv-1") });
    });
  });

  describe("useUpdateTemplate", () => {
    it("PUTs the template and writes the returned cv into the detail cache", async () => {
      const updated = makeCv({ template: "modern" });
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: updated }));
      const { result, queryClient } = renderHookWithQuery(() => useUpdateTemplate("cv-1"));
      queryClient.setQueryData<CvDetail>(cvKeys.detail("cv-1"), { cv: makeCv({ template: "classic" }), questions: [] });

      await result.current.mutateAsync("modern");

      expect(fetch).toHaveBeenCalledWith(
        "/api/cvs/cv-1/template",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ template: "modern" }) }),
      );
      expect(queryClient.getQueryData<CvDetail>(cvKeys.detail("cv-1"))?.cv.template).toBe("modern");
    });
  });

  describe("useUpdateCvMeta", () => {
    it("PUTs title+targetRole, writes the detail cache, and invalidates the list", async () => {
      const updated = makeCv({ title: "New Title", targetRole: "New Role" });
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ cv: updated }));
      const { result, queryClient } = renderHookWithQuery(() => useUpdateCvMeta("cv-1"));
      queryClient.setQueryData<CvDetail>(cvKeys.detail("cv-1"), { cv: makeCv(), questions: [] });
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      await result.current.mutateAsync({ title: "New Title", targetRole: "New Role" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/cvs/cv-1/meta",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ title: "New Title", targetRole: "New Role" }) }),
      );
      expect(queryClient.getQueryData<CvDetail>(cvKeys.detail("cv-1"))?.cv.title).toBe("New Title");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cvKeys.list });
    });
  });

  describe("useDismissQuestion", () => {
    it("POSTs /dismiss and invalidates that CV's detail query", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
      const { result, queryClient } = renderHookWithQuery(() => useDismissQuestion("cv-1"));
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      await result.current.mutateAsync("q1");

      expect(fetch).toHaveBeenCalledWith("/api/cvs/cv-1/questions/q1/dismiss", expect.objectContaining({ method: "POST" }));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: cvKeys.detail("cv-1") });
    });
  });
});
