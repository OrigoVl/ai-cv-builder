import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CvEditor } from "./CvEditor.js";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";
import type { CvDraft } from "./useCvDraft.js";

function makeDraft(overrides: Partial<CvDraft> = {}): CvDraft {
  return {
    content: EMPTY_CV_CONTENT,
    patch: vi.fn(),
    saveState: "idle",
    reload: vi.fn(),
    ...overrides,
  };
}

describe("CvEditor", () => {
  it("renders all the section headings", () => {
    render(<CvEditor draft={makeDraft()} />);
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Experience" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Education" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
  });

  it("editing a contact field patches only that field, leaving the rest of the content untouched", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    const content = { ...EMPTY_CV_CONTENT, summary: "Existing summary" };
    render(<CvEditor draft={makeDraft({ content, patch })} />);

    await user.type(screen.getByPlaceholderText("Full name"), "J");

    expect(patch).toHaveBeenCalledWith({
      ...content,
      contact: { ...content.contact, name: "J" },
    });
  });

  it("editing the summary textarea patches the summary field", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    render(<CvEditor draft={makeDraft({ patch })} />);

    await user.type(screen.getByLabelText("Summary"), "S");

    expect(patch).toHaveBeenCalledWith({ ...EMPTY_CV_CONTENT, summary: "S" });
  });

  it("shows nothing for an idle save state, and the right indicator for 'saved'", () => {
    const { rerender } = render(<CvEditor draft={makeDraft({ saveState: "idle" })} />);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    rerender(<CvEditor draft={makeDraft({ saveState: "saved" })} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("clicking Reload on a conflict calls draft.reload", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    render(<CvEditor draft={makeDraft({ saveState: "conflict", reload })} />);

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalled();
  });

  it("adding an experience entry patches content.experience via the editor below", async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    render(<CvEditor draft={makeDraft({ patch })} />);

    await user.click(screen.getByRole("button", { name: "Add experience" }));

    expect(patch).toHaveBeenCalledWith({
      ...EMPTY_CV_CONTENT,
      experience: [{ company: "", title: "", location: "", startDate: "", endDate: "", bullets: [] }],
    });
  });
});
