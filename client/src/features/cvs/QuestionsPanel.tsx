import { useState } from "react";
import { CircleHelp, Send, X } from "lucide-react";
import { useAnswerQuestion, useDismissQuestion } from "../../shared/queries/cvs.js";
import { Spinner } from "../../shared/Spinner.js";
import type { CvQuestion } from "../../shared/types.js";

function QuestionRow({ cvId, question, index }: { cvId: string; question: CvQuestion; index: number }) {
  const [answer, setAnswer] = useState("");
  const answerMutation = useAnswerQuestion(cvId);
  const dismissMutation = useDismissQuestion(cvId);
  const busy = answerMutation.isPending || dismissMutation.isPending;

  function submit() {
    if (!answer.trim()) return;
    answerMutation.mutate({ questionId: question.id, answer: answer.trim() });
  }

  return (
    <li className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[11px] font-semibold text-amber-600">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-snug text-gray-800">{question.question}</p>
          <button
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 disabled:opacity-50"
            onClick={() => dismissMutation.mutate(question.id)}
            disabled={busy}
            aria-label="Skip this question"
            title="Skip this question"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {question.reason && <p className="mt-0.5 text-xs text-gray-400">{question.reason}</p>}
        <div className="mt-2 flex gap-2">
          <input
            className="input py-2 text-sm"
            placeholder="Your answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            disabled={busy}
          />
          <button
            className="btn-primary btn-icon shrink-0"
            onClick={submit}
            disabled={busy || !answer.trim()}
            aria-label="Save answer"
          >
            {answerMutation.isPending ? <Spinner /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </li>
  );
}

export function QuestionsPanel({ cvId, questions }: { cvId: string; questions: CvQuestion[] }) {
  const open = questions.filter((q) => q.status === "open");
  const resolved = questions.length - open.length;
  if (open.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <CircleHelp className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-gray-900">Questions to review</h2>
        </div>
        <span className="pill bg-amber-50 text-amber-700">
          {open.length} open{resolved > 0 ? ` · ${resolved} done` : ""}
        </span>
      </div>

      {questions.length > 1 && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-amber-400 transition-all"
            style={{ width: `${(resolved / questions.length) * 100}%` }}
          />
        </div>
      )}

      <p className="mb-1 mt-3 text-xs text-gray-500">
        We couldn't confirm these from your source — answer to fill them in, or skip to leave them blank.
      </p>
      <ul className="divide-y divide-gray-100">
        {open.map((q, i) => (
          <QuestionRow key={q.id} cvId={cvId} question={q} index={i + 1} />
        ))}
      </ul>
    </div>
  );
}
