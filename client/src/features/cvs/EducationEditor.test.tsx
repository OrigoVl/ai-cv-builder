import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EducationEditor } from "./EducationEditor.js";
import type { EducationEntry } from "../../shared/types.js";

function entry(overrides: Partial<EducationEntry> = {}): EducationEntry {
  return { institution: "", degree: "", field: "", startDate: "", endDate: "", ...overrides };
}

// EducationEditor is a controlled component — see BulletListEditor.test.tsx for why typing
// needs a stateful wrapper rather than a no-op onChange mock.
function StatefulEducationEditor({
  initial,
  onChangeSpy,
}: {
  initial: EducationEntry[];
  onChangeSpy: (entries: EducationEntry[]) => void;
}) {
  const [entries, setEntries] = useState(initial);
  return (
    <EducationEditor
      entries={entries}
      onChange={(next) => {
        setEntries(next);
        onChangeSpy(next);
      }}
    />
  );
}

describe("EducationEditor", () => {
  it("shows an empty-state message when there are no entries", () => {
    render(<EducationEditor entries={[]} onChange={vi.fn()} />);
    expect(screen.getByText("No education yet — add one below.")).toBeInTheDocument();
  });

  it("appends a blank entry when 'Add education' is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EducationEditor entries={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add education" }));

    expect(onChange).toHaveBeenCalledWith([entry()]);
  });

  it("edits a field on the right entry without touching the others", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    const initial = [entry({ institution: "MIT" }), entry({ institution: "Stanford" })];
    render(<StatefulEducationEditor initial={initial} onChangeSpy={onChangeSpy} />);

    await user.type(screen.getAllByPlaceholderText("Degree")[1]!, "BSc");

    const lastCall = onChangeSpy.mock.calls.at(-1)![0] as EducationEntry[];
    expect(lastCall[0]).toEqual(initial[0]);
    expect(lastCall[1]!.degree).toBe("BSc");
    expect(lastCall[1]!.institution).toBe("Stanford");
  });

  it("removes the clicked entry only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const entries = [entry({ institution: "First" }), entry({ institution: "Second" })];
    render(<EducationEditor entries={entries} onChange={onChange} />);

    await user.click(screen.getAllByRole("button", { name: "Remove education" })[0]!);

    expect(onChange).toHaveBeenCalledWith([entry({ institution: "Second" })]);
  });
});
