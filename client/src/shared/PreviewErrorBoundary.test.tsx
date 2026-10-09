import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreviewErrorBoundary } from "./PreviewErrorBoundary.js";

function Bomb(): never {
  throw new Error("boom");
}

describe("PreviewErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <PreviewErrorBoundary>
        <p>Live preview content</p>
      </PreviewErrorBoundary>,
    );
    expect(screen.getByText("Live preview content")).toBeInTheDocument();
  });

  it("catches a render error from a child and shows the fallback instead of crashing the page", () => {
    // React logs the error to console.error even when a boundary catches it — expected noise,
    // silenced here so the test output stays readable.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PreviewErrorBoundary>
        <Bomb />
      </PreviewErrorBoundary>,
    );

    expect(screen.getByText(/Couldn't render the live preview/)).toBeInTheDocument();
    expect(screen.getByText(/Your edits are still saved/)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
