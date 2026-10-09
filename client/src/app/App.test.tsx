// App.tsx's RequireAuth (not exported, only reachable by rendering App itself) is the single
// gate every protected page sits behind — worth pinning directly rather than trusting it only
// through e2e. CvListPage (behind the gate) needs a mocked fetch to resolve at all; that's
// incidental to what's being tested here, which is the gate itself.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/query-test-utils.js";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("../shared/auth-client.js", () => ({
  useSession: useSessionMock,
  signOut: vi.fn(),
}));

const { App } = await import("./App.js");

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("App / RequireAuth", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ cvs: [] }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("shows a loading state while the session is still pending, renders neither login nor app content", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });
    renderWithProviders(<App />, { route: "/" });

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
    expect(screen.queryByText("Your CVs")).not.toBeInTheDocument();
  });

  it("redirects to the login page when there is no session", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    renderWithProviders(<App />, { route: "/" });

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByText("Your CVs")).not.toBeInTheDocument();
  });

  it("renders the protected content when a session exists", async () => {
    useSessionMock.mockReturnValue({ data: { session: { id: "s1" }, user: { name: "Jane", email: "jane@example.com" } }, isPending: false });
    renderWithProviders(<App />, { route: "/" });

    await waitFor(() => expect(screen.getByText("Your CVs")).toBeInTheDocument());
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("redirects an unknown path to '/' once authenticated", async () => {
    useSessionMock.mockReturnValue({ data: { session: { id: "s1" }, user: { name: "Jane", email: "jane@example.com" } }, isPending: false });
    renderWithProviders(<App />, { route: "/this-page-does-not-exist" });

    await waitFor(() => expect(screen.getByText("Your CVs")).toBeInTheDocument());
  });
});
