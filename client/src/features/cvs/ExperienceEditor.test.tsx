import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperienceEditor } from "./ExperienceEditor.js";
import type { ExperienceEntry } from "../../shared/types.js";

function entry(overrides: Partial<ExperienceEntry> = {}): ExperienceEntry {
  return { company: "", title: "", location: "", startDate: "", endDate: "", bullets: [], ...overrides };
}

// ExperienceEditor is a controlled component — see BulletListEditor.test.tsx for why typing
// needs a stateful wrapper rather than a no-op onChange mock.
function StatefulExperienceEditor({
  initial,
  onChangeSpy,
}: {
  initial: ExperienceEntry[];
  onChangeSpy: (entries: ExperienceEntry[]) => void;
}) {
  const [entries, setEntries] = useState(initial);
  return (
    <ExperienceEditor
      entries={entries}
      onChange={(next) => {
        setEntries(next);
        onChangeSpy(next);
      }}
    />
  );
}

describe("ExperienceEditor", () => {
  it("shows an empty-state message when there are no entries", () => {
    render(<ExperienceEditor entries={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No experience yet — add a position below.")).toBeInTheDocument();
  });

  it("appends a blank entry when 'Add experience' is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ExperienceEditor entries={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add experience" }));

    expect(onChange).toHaveBeenCalledWith([entry()]);
  });

  it("edits a field on the right entry without touching the others", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    const initial = [entry({ company: "Acme" }), entry({ company: "Globex" })];
    render(<StatefulExperienceEditor initial={initial} onChangeSpy={onChangeSpy} />);

    await user.type(screen.getAllByPlaceholderText("Job title")[1]!, "Engineer");

    const lastCall = onChangeSpy.mock.calls.at(-1)![0] as ExperienceEntry[];
    expect(lastCall[0]).toEqual(initial[0]);
    expect(lastCall[1]!.title).toBe("Engineer");
    expect(lastCall[1]!.company).toBe("Globex");
  });

  it("moves an entry down and swaps its neighbor, disabling the boundary buttons", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const entries = [entry({ company: "First" }), entry({ company: "Second" })];
    render(<ExperienceEditor entries={entries} onChange={onChange} />);

    const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
    const moveDownButtons = screen.getAllByRole("button", { name: "Move down" });
    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons[1]).toBeDisabled();

    await user.click(moveDownButtons[0]!);
    expect(onChange).toHaveBeenCalledWith([entry({ company: "Second" }), entry({ company: "First" })]);
  });

  it("removes the clicked entry only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const entries = [entry({ company: "First" }), entry({ company: "Second" })];
    render(<ExperienceEditor entries={entries} onChange={onChange} />);

    await user.click(screen.getAllByRole("button", { name: "Remove position" })[0]!);

    expect(onChange).toHaveBeenCalledWith([entry({ company: "Second" })]);
  });
});
