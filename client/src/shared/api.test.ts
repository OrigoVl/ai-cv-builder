import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "./api.js";

describe("api wrapper", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns parsed JSON on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ cvs: [] }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const result = await api.get<{ cvs: unknown[] }>("/cvs");
    expect(result).toEqual({ cvs: [] });
  });

  it("returns undefined for a 204", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const result = await api.del("/cvs/1");
    expect(result).toBeUndefined();
  });

  it("throws ApiError with the server's message on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "CV not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(api.get("/cvs/missing")).rejects.toMatchObject(
      new ApiError(404, "CV not found"),
    );
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(api.get("/cvs")).rejects.toMatchObject({ status: 500 });
  });

  it("sends a JSON body with the right content-type for post/put", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await api.put("/cvs/1", { version: 1 });
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(JSON.stringify({ version: 1 }));
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("sends FormData as-is without forcing a JSON content-type", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const form = new FormData();
    form.set("title", "x");
    await api.post("/cvs", form);
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.body).toBe(form);
  });
});
