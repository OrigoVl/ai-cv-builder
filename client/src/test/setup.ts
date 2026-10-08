import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.ts sets `globals: false`, so @testing-library/react can't auto-detect a global
// `afterEach` to register its usual automatic cleanup — without this, each test's rendered DOM
// stays mounted into the next test in the same file, and a later test matching the same text
// (e.g. two tests both rendering a "Jane Doe" preview) fails with "multiple elements found".
afterEach(() => {
  cleanup();
});
