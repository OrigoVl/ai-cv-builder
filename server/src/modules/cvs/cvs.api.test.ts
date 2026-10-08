// Exercises the REAL app (real Express routing, real better-auth sessions, real Drizzle
// queries) end-to-end over actual HTTP, against a disposable PGlite-backed Postgres — not a
// mocked approximation. The worker is never started here (we only import app.js, not index.js),
// so these tests cover the API/authorization/validation layer, not job completion — see
// jobs/queue.test.ts and llm/grounding.test.ts for those.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import { createTestDb } from "../../db/test-db.js";

const PORT = 58921;
process.env.PORT = String(PORT);
const BASE_URL = `http://localhost:${PORT}`;
process.env.CLIENT_ORIGIN = BASE_URL; // must match better-auth's trustedOrigins check

let server: Server;

interface Session {
  cookie: string;
}

async function registerAndSignIn(email: string): Promise<Session> {
  const password = "password1234";
  const signUp = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password, name: email }),
  });
  if (!signUp.ok) throw new Error(`sign-up failed: ${signUp.status} ${await signUp.text()}`);
  const cookie = signUp.headers.get("set-cookie")!.split(";")[0]!;
  return { cookie };
}

async function api(session: Session, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("cookie", session.cookie);
  if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");
  return fetch(`${BASE_URL}/api${path}`, { ...init, headers });
}

beforeAll(async () => {
  const testDb = await createTestDb();
  vi.doMock("../../db/client.js", () => ({ db: testDb }));

  const { createApp } = await import("../../app.js");
  server = createApp().listen(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
}, 20_000);

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("CV API", () => {
  it("creates a CV from free text and returns 202 generating", async () => {
    const alice = await registerAndSignIn("alice@example.test");
    const res = await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "My CV", targetRole: "Backend Engineer", sourceText: "Jane Doe, engineer." }),
    });
    expect(res.status).toBe(202);
    const { cv } = (await res.json()) as { cv: { id: string; status: string } };
    expect(cv.status).toBe("generating");
  });

  it("rejects creation with neither a file nor sourceText", async () => {
    const alice = await registerAndSignIn("alice2@example.test");
    const res = await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "My CV", targetRole: "Backend Engineer" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a second concurrent generation for the same user", async () => {
    const alice = await registerAndSignIn("alice3@example.test");
    const first = await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "First", targetRole: "Engineer", sourceText: "some text" }),
    });
    expect(first.status).toBe(202);

    const second = await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "Second", targetRole: "Engineer", sourceText: "more text" }),
    });
    expect(second.status).toBe(409);
  });

  it("never lets one user see, edit, or delete another user's CV (404, not 403 — no existence leak)", async () => {
    const alice = await registerAndSignIn("alice4@example.test");
    const bob = await registerAndSignIn("bob4@example.test");

    const createRes = await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "Alice CV", targetRole: "Engineer", sourceText: "Alice's background" }),
    });
    const { cv } = (await createRes.json()) as { cv: { id: string } };

    expect((await api(bob, `/cvs/${cv.id}`)).status).toBe(404);
    expect((await api(alice, `/cvs/${cv.id}`)).status).toBe(200);

    const putRes = await api(bob, `/cvs/${cv.id}`, {
      method: "PUT",
      body: JSON.stringify({
        content: { contact: { name: "Hacked", email: "", phone: "", location: "", links: [] }, summary: "", experience: [], education: [], skills: [] },
        version: 1,
      }),
    });
    expect(putRes.status).toBe(404);

    expect((await api(bob, `/cvs/${cv.id}`, { method: "DELETE" })).status).toBe(404);

    expect((await api(bob, `/cvs/${cv.id}/pdf`)).status).toBe(404);
    expect((await api(bob, `/cvs/${cv.id}/questions/00000000-0000-0000-0000-000000000000/answer`, {
      method: "POST",
      body: JSON.stringify({ answer: "hack" }),
    })).status).toBe(404);
  });

  it("lists only the signed-in user's own CVs", async () => {
    const alice = await registerAndSignIn("alice5@example.test");
    const bob = await registerAndSignIn("bob5@example.test");
    await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "Alice CV", targetRole: "Engineer", sourceText: "text" }),
    });

    const bobList = (await (await api(bob, "/cvs")).json()) as { cvs: unknown[] };
    expect(bobList.cvs).toHaveLength(0);

    const aliceList = (await (await api(alice, "/cvs")).json()) as { cvs: unknown[] };
    expect(aliceList.cvs.length).toBeGreaterThan(0);
  });

  it("rejects a PUT with a stale version (optimistic-concurrency conflict)", async () => {
    const alice = await registerAndSignIn("alice6@example.test");
    const createRes = await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "CV", targetRole: "Engineer", sourceText: "text" }),
    });
    const { cv } = (await createRes.json()) as { cv: { id: string; version: number } };

    const emptyContent = {
      contact: { name: "", email: "", phone: "", location: "", links: [] },
      summary: "",
      experience: [],
      education: [],
      skills: [],
    };

    const staleVersion = cv.version + 5; // deliberately wrong
    const res = await api(alice, `/cvs/${cv.id}`, {
      method: "PUT",
      body: JSON.stringify({ content: emptyContent, version: staleVersion }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects an uploaded file whose content isn't actually a PDF, despite a spoofed MIME type", async () => {
    const alice = await registerAndSignIn("alice7@example.test");
    const form = new FormData();
    form.set("title", "CV");
    form.set("targetRole", "Engineer");
    form.set("file", new Blob(["this is not a pdf"], { type: "application/pdf" }), "fake.pdf");

    const res = await api(alice, "/cvs", { method: "POST", body: form });
    expect(res.status).toBe(400);
  });

  it("rejects an upload over the size limit", async () => {
    const alice = await registerAndSignIn("alice8@example.test");
    const form = new FormData();
    form.set("title", "CV");
    form.set("targetRole", "Engineer");
    const big = new Uint8Array(6 * 1024 * 1024); // 6MB > the 5MB limit
    form.set("file", new Blob([big], { type: "application/pdf" }), "big.pdf");

    const res = await api(alice, "/cvs", { method: "POST", body: form });
    expect(res.status).toBe(400);
  });

  it("refuses to render a PDF before generation has produced any content", async () => {
    const alice = await registerAndSignIn("alice9@example.test");
    const createRes = await api(alice, "/cvs", {
      method: "POST",
      body: JSON.stringify({ title: "CV", targetRole: "Engineer", sourceText: "text" }),
    });
    const { cv } = (await createRes.json()) as { cv: { id: string } };

    const res = await api(alice, `/cvs/${cv.id}/pdf`);
    expect(res.status).toBe(400);
  });
});
