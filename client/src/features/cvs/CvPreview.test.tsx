import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CvPreview } from "./CvPreview.js";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";

const content = {
  ...EMPTY_CV_CONTENT,
  contact: { name: "Jane Doe", email: "jane@example.com", phone: "", location: "Berlin", links: [] },
  summary: "Backend engineer.",
  experience: [
    { company: "Acme Corp", title: "Engineer", location: "", startDate: "2019", endDate: "2022", bullets: ["Shipped things"] },
  ],
  skills: ["TypeScript"],
};

describe("CvPreview", () => {
  it("renders the content with the classic template", () => {
    render(<CvPreview content={content} template="classic" />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Backend engineer.")).toBeInTheDocument();
    expect(screen.getByText("Shipped things")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders the same content with the modern template", () => {
    render(<CvPreview content={content} template="modern" />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Shipped things")).toBeInTheDocument();
  });

  it("falls back to 'Untitled CV' when there's no name yet", () => {
    render(<CvPreview content={EMPTY_CV_CONTENT} template="classic" />);
    expect(screen.getByText("Untitled CV")).toBeInTheDocument();
  });
});
