import { useCallback, useEffect, useRef } from "react";

/** Debounces `fn` by `delayMs`, and flushes any pending call on unmount — used for autosave so
 * navigating away right after typing doesn't drop the last edit. */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingArgsRef = useRef<Args | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current && pendingArgsRef.current) {
        clearTimeout(timeoutRef.current);
        fnRef.current(...pendingArgsRef.current);
      }
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      pendingArgsRef.current = args;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        pendingArgsRef.current = null;
        fnRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}
