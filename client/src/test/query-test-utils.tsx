import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, type RenderHookOptions } from "@testing-library/react";

function newTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function renderWithQuery(ui: ReactElement) {
  const queryClient = newTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

/** Same QueryClientProvider wrapper as renderWithQuery, for testing a hook (e.g. useCvDraft)
 * directly rather than a rendered component. Returns the QueryClient too, so a test can inspect
 * or seed cache state (e.g. to check a mutation's onSuccess wrote the right data back). Forwards
 * `initialProps` so a test can `rerender({...newProps})` to simulate the hook's input changing
 * (e.g. a background poll bringing a newer `cv`), same as plain renderHook. */
export function renderHookWithQuery<Result, Props>(
  callback: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, "wrapper">,
) {
  const queryClient = newTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const result = renderHook(callback, { ...options, wrapper: Wrapper });
  return { ...result, queryClient };
}
