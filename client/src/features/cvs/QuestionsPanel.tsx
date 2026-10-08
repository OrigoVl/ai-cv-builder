import { useState } from "react";
import { CircleHelp, Send, X } from "lucide-react";
import { useAnswerQuestion, useDismissQuestion } from "../../shared/queries/cvs.js";
import { Spinner } from "../../shared/Spinner.js";
import type { CvQuestion } from "../../shared/types.js";

function QuestionRow({ cvId, question }: { cvId: string; question: CvQuestion }) {
  const [answer, setAnswer] = useState("");
  const answerMutation = useAnswerQuestion(cvId);
  const dismissMutation = useDismissQuestion(cvId);

  function submit() {
    if (!answer.trim()) return;
    answerMutation.mutate({ questionId: question.id, answer: answer.trim() });
  }

  return (
    <li className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800">{question.question}</p>
        <button
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-amber-100 hover:text-gray-600"
          onClick={() => dismissMutation.mutate(question.id)}
          disabled={dismissMutation.isPending}
          aria-label="Skip this question"
          title="Skip this question"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {question.reason && <p className="mt-1 text-xs text-amber-700/70">{question.reason}</p>}
      <div className="mt-2.5 flex gap-2">
        <input
          className="input bg-white"
          placeholder="Your answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button
          className="btn-primary btn-icon shrink-0"
          onClick={submit}
          disabled={answerMutation.isPending || !answer.trim()}
          aria-label="Save answer"
        >
          {answerMutation.isPending ? <Spinner /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </li>
  );
}

export function QuestionsPanel({ cvId, questions }: { cvId: string; questions: CvQuestion[] }) {
  const open = questions.filter((q) => q.status === "open");
  if (open.length === 0) return null;

  return (
    <div className="card border-amber-100">
      <div className="mb-1 flex items-center gap-2">
        <CircleHelp className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-900">
          {open.length} question{open.length > 1 ? "s" : ""} to review
        </h2>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        We couldn't confirm these from your source — answer to fill them in, or skip to leave them blank.
      </p>
      <ul className="space-y-2.5">
        {open.map((q) => (
          <QuestionRow key={q.id} cvId={cvId} question={q} />
        ))}
      </ul>
    </div>
  );
}
