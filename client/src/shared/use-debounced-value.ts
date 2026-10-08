import { useEffect, useState } from "react";

/** Returns `value`, but updated only after it's stopped changing for `delayMs` — used to avoid
 * re-rendering the PDF preview (a genuinely expensive operation: it re-runs react-pdf's layout
 * engine) on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
