import { Link } from "react-router";
import { useCvs, useDeleteCv } from "../../shared/queries/cvs.js";
import { StatusBadge } from "./StatusBadge.js";

export function CvListPage() {
  const { data, isLoading, error } = useCvs();
  const deleteCv = useDeleteCv();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Your CVs</h1>
        <Link to="/new" className="btn-primary">
          New CV
        </Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">Could not load your CVs.</p>}

      {data && data.cvs.length === 0 && (
        <div className="card text-center text-sm text-gray-500">
          No CVs yet. <Link to="/new" className="text-brand-600 underline">Create your first one</Link>.
        </div>
      )}

      <ul className="space-y-2">
        {data?.cvs.map((cv) => (
          <li key={cv.id} className="card flex items-center justify-between gap-3">
            <Link to={`/cvs/${cv.id}`} className="min-w-0 flex-1">
              <div className="truncate font-medium">{cv.title}</div>
              <div className="truncate text-sm text-gray-500">{cv.targetRole}</div>
            </Link>
            <StatusBadge status={cv.status} />
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm(`Delete "${cv.title}"? This cannot be undone.`)) deleteCv.mutate(cv.id);
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
