import { AlertTriangle, RotateCcw } from "lucide-react";
import { useRetryCv } from "../../shared/queries/cvs.js";
import { Spinner } from "../../shared/Spinner.js";

export function FailedState({ cvId, error }: { cvId: string; error: string | null }) {
  const retry = useRetryCv(cvId);
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div>
        <p className="font-medium text-gray-900">Generation failed</p>
        {error && <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{error}</p>}
      </div>
      <button className="btn-primary mt-1" onClick={() => retry.mutate()} disabled={retry.isPending}>
        {retry.isPending ? <Spinner /> : <RotateCcw className="h-4 w-4" />}
        Try again
      </button>
    </div>
  );
}
