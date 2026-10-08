import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "../../test/query-test-utils.js";
import { QuestionsPanel } from "./QuestionsPanel.js";
import type { CvQuestion } from "../../shared/types.js";

function question(overrides: Partial<CvQuestion>): CvQuestion {
  return {
    id: "q1",
    cvId: "cv1",
    fieldPath: "contact.email",
    question: "What's your email?",
    reason: null,
    answer: null,
    status: "open",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("QuestionsPanel", () => {
  it("renders only open questions, not answered or dismissed ones", () => {
    const questions = [
      question({ id: "q1", question: "What's your email?", status: "open" }),
      question({ id: "q2", question: "Already answered", status: "answered" }),
      question({ id: "q3", question: "Already dismissed", status: "dismissed" }),
    ];
    renderWithQuery(<QuestionsPanel cvId="cv1" questions={questions} />);

    expect(screen.getByText("What's your email?")).toBeInTheDocument();
    expect(screen.queryByText("Already answered")).not.toBeInTheDocument();
    expect(screen.queryByText("Already dismissed")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no open questions", () => {
    const { container } = renderWithQuery(
      <QuestionsPanel cvId="cv1" questions={[question({ status: "dismissed" })]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
