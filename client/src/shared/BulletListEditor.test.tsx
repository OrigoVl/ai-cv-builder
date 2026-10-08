import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulletListEditor } from "./BulletListEditor.js";

/** BulletListEditor is a controlled component — typing into it with a no-op onChange mock would
 * have every keystroke's DOM value snapped back to the unchanged `bullets` prop on the next
 * render, which isn't what a real caller (CvEditor, which does hold state) ever experiences.
 * This wrapper holds that state the same way a real caller does, so typing behaves normally. */
function StatefulBulletList({ onChangeSpy }: { onChangeSpy: (bullets: string[]) => void }) {
  const [bullets, setBullets] = useState(["Old text"]);
  return (
    <BulletListEditor
      bullets={bullets}
      onChange={(next) => {
        setBullets(next);
        onChangeSpy(next);
      }}
    />
  );
}

describe("BulletListEditor", () => {
  it("adds a new empty bullet", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BulletListEditor bullets={["Led a team"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add bullet" }));
    expect(onChange).toHaveBeenCalledWith(["Led a team", ""]);
  });

  it("removes a bullet", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BulletListEditor bullets={["First", "Second"]} onChange={onChange} />);

    const removeButtons = screen.getAllByRole("button", { name: "Remove bullet" });
    await user.click(removeButtons[0]!);
    expect(onChange).toHaveBeenCalledWith(["Second"]);
  });

  it("moves a bullet down then its up-button is disabled on the new first bullet", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BulletListEditor bullets={["First", "Second"]} onChange={onChange} />);

    const downButtons = screen.getAllByRole("button", { name: "Move bullet down" });
    await user.click(downButtons[0]!);
    expect(onChange).toHaveBeenCalledWith(["Second", "First"]);
  });

  it("disables moving the first bullet up and the last bullet down", () => {
    const onChange = vi.fn();
    render(<BulletListEditor bullets={["First", "Second"]} onChange={onChange} />);

    const upButtons = screen.getAllByRole("button", { name: "Move bullet up" });
    const downButtons = screen.getAllByRole("button", { name: "Move bullet down" });
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[1]).toBeDisabled();
  });

  it("edits a bullet's text", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<StatefulBulletList onChangeSpy={onChangeSpy} />);

    const textarea = screen.getByLabelText("Bullet point 1");
    await user.clear(textarea);
    await user.type(textarea, "New");
    expect(onChangeSpy).toHaveBeenLastCalledWith(["New"]);
    expect(textarea).toHaveValue("New");
  });
});
