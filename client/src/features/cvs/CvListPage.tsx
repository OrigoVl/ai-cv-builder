import { Link } from "react-router";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useCvs, useDeleteCv } from "../../shared/queries/cvs.js";
import { StatusBadge } from "./StatusBadge.js";
import { HowItWorks } from "./HowItWorks.js";

export function CvListPage() {
  const { data, isLoading, error } = useCvs();
  const deleteCv = useDeleteCv();
  const isEmpty = data && data.cvs.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Your CVs</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isEmpty ? "Let's build your first one." : "Pick up an existing draft, or start a new one."}
          </p>
        </div>
        <Link to="/new" className="btn-primary shrink-0">
          <Plus className="h-4 w-4" />
          New CV
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="card h-[72px] animate-pulse bg-gray-50" />
          ))}
        </div>
      )}

      {error && (
        <div className="card border-red-100 bg-red-50 text-sm text-red-700">Could not load your CVs.</div>
      )}

      {isEmpty && <HowItWorks />}

      {data && data.cvs.length > 0 && (
        <ul className="space-y-2.5">
          {data.cvs.map((cv) => (
            <li key={cv.id} className="group card flex items-center gap-4 transition-shadow hover:shadow-popover">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <FileText className="h-5 w-5" />
              </span>
              <Link to={`/cvs/${cv.id}`} className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900">{cv.title}</div>
                <div className="truncate text-sm text-gray-500">{cv.targetRole}</div>
              </Link>
              <StatusBadge status={cv.status} />
              <button
                className="btn-ghost btn-icon shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:!bg-red-50 hover:!text-red-600"
                onClick={() => {
                  if (confirm(`Delete "${cv.title}"? This cannot be undone.`)) deleteCv.mutate(cv.id);
                }}
                aria-label={`Delete ${cv.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
