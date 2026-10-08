import { useState } from "react";
import { useAnswerQuestion, useDismissQuestion } from "../../shared/queries/cvs.js";
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
    <li className="space-y-2 border-b border-gray-100 py-3 last:border-0">
      <p className="text-sm font-medium text-gray-800">{question.question}</p>
      {question.reason && <p className="text-xs text-gray-400">{question.reason}</p>}
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Your answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn-primary shrink-0" onClick={submit} disabled={answerMutation.isPending || !answer.trim()}>
          Save
        </button>
      </div>
      <button
        className="text-xs text-gray-400 underline"
        onClick={() => dismissMutation.mutate(question.id)}
        disabled={dismissMutation.isPending}
      >
        Skip this question
      </button>
    </li>
  );
}

export function QuestionsPanel({ cvId, questions }: { cvId: string; questions: CvQuestion[] }) {
  const open = questions.filter((q) => q.status === "open");
  if (open.length === 0) return null;

  return (
    <div className="card">
      <h2 className="mb-1 text-sm font-semibold">
        {open.length} question{open.length > 1 ? "s" : ""} to review
      </h2>
      <p className="mb-2 text-xs text-gray-500">
        We couldn't confirm these from your source — answer them to fill in or verify the details, or skip to leave
        them blank.
      </p>
      <ul>
        {open.map((q) => (
          <QuestionRow key={q.id} cvId={cvId} question={q} />
        ))}
      </ul>
    </div>
  );
}
