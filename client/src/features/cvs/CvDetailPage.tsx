import { Link, useParams } from "react-router";
import { ArrowLeft, Download } from "lucide-react";
import { useCv } from "../../shared/queries/cvs.js";
import type { Cv, CvQuestion } from "../../shared/types.js";
import { StatusBadge } from "./StatusBadge.js";
import { GeneratingState } from "./GeneratingState.js";
import { FailedState } from "./FailedState.js";
import { CvEditor } from "./CvEditor.js";
import { CvPreview } from "./CvPreview.js";
import { TemplateSwitcher } from "./TemplateSwitcher.js";
import { QuestionsPanel } from "./QuestionsPanel.js";
import { CvDetailSkeleton } from "./CvDetailSkeleton.js";
import { useCvDraft } from "./useCvDraft.js";

export function CvDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useCv(id);

  if (isLoading) return <CvDetailSkeleton />;
  if (error || !data) return <p className="text-sm text-red-600">Could not load this CV.</p>;

  const { cv, questions } = data;

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Back to your CVs
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-gray-900">{cv.title}</h1>
          <p className="truncate text-sm text-gray-500">{cv.targetRole}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={cv.status} />
          {cv.status === "ready" && (
            <a className="btn-primary" href={`/api/cvs/${cv.id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </a>
          )}
        </div>
      </div>

      {cv.status === "generating" && <GeneratingState />}
      {cv.status === "failed" && <FailedState cvId={cv.id} error={cv.error} />}
      {cv.status === "ready" && cv.content && <ReadyCv cv={cv} questions={questions} />}
    </div>
  );
}

function ReadyCv({ cv, questions }: { cv: Cv; questions: CvQuestion[] }) {
  const draft = useCvDraft(cv);

  return (
    <>
      <QuestionsPanel cvId={cv.id} questions={questions} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Template</span>
        <TemplateSwitcher cvId={cv.id} current={cv.template} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <CvEditor draft={draft} />
        <CvPreview content={draft.content} template={cv.template} />
      </div>
    </>
  );
}
