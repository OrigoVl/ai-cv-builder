import { useParams } from "react-router";
import { useCv } from "../../shared/queries/cvs.js";
import { StatusBadge } from "./StatusBadge.js";
import { GeneratingState } from "./GeneratingState.js";
import { FailedState } from "./FailedState.js";
import { CvEditor } from "./CvEditor.js";
import { QuestionsPanel } from "./QuestionsPanel.js";

export function CvDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useCv(id);

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error || !data) return <p className="text-sm text-red-600">Could not load this CV.</p>;

  const { cv, questions } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{cv.title}</h1>
          <p className="truncate text-sm text-gray-500">{cv.targetRole}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={cv.status} />
          {cv.status === "ready" && (
            <a className="btn-primary" href={`/api/cvs/${cv.id}/pdf`} target="_blank" rel="noreferrer">
              Download PDF
            </a>
          )}
        </div>
      </div>

      {cv.status === "generating" && <GeneratingState />}
      {cv.status === "failed" && <FailedState cvId={cv.id} error={cv.error} />}
      {cv.status === "ready" && cv.content && (
        <>
          <QuestionsPanel cvId={cv.id} questions={questions} />
          <CvEditor cv={cv} />
        </>
      )}
    </div>
  );
}
