import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDebouncedCallback } from "./use-debounced-callback.js";

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls fn after the delay, not immediately", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    result.current("a");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledWith("a");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("coalesces rapid calls into one, using the last call's args", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 500));

    result.current("a");
    vi.advanceTimersByTime(200);
    result.current("b");
    vi.advanceTimersByTime(200);
    result.current("c");

    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("flushes a pending call immediately on unmount, so navigating away right after typing doesn't drop the edit", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 500));

    result.current("unsaved edit");
    expect(fn).not.toHaveBeenCalled();

    unmount();
    expect(fn).toHaveBeenCalledWith("unsaved edit");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not call fn again on unmount when there was no pending call", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 500));

    result.current("a");
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);

    unmount();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("picks up a changed callback without needing a new debounced function identity", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useDebouncedCallback(fn, 500), {
      initialProps: { fn: fn1 },
    });
    const debounced = result.current;

    rerender({ fn: fn2 });
    debounced("a");
    vi.advanceTimersByTime(500);

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledWith("a");
  });
});
