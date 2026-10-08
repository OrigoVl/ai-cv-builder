import { useRetryCv } from "../../shared/queries/cvs.js";

export function FailedState({ cvId, error }: { cvId: string; error: string | null }) {
  const retry = useRetryCv(cvId);
  return (
    <div className="card space-y-3 py-8 text-center">
      <p className="font-medium text-red-700">Generation failed</p>
      {error && <p className="text-sm text-gray-500">{error}</p>}
      <button className="btn-primary" onClick={() => retry.mutate()} disabled={retry.isPending}>
        {retry.isPending ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}
