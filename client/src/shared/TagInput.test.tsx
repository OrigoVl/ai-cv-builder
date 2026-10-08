import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "./TagInput.js";

describe("TagInput", () => {
  it("adds a tag on Enter and clears the draft", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput label="Skills" values={[]} onChange={onChange} placeholder="Add a skill" />);

    const input = screen.getByPlaceholderText("Add a skill");
    await user.type(input, "TypeScript{Enter}");

    expect(onChange).toHaveBeenCalledWith(["TypeScript"]);
  });

  it("adds a tag on comma", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput label="Skills" values={[]} onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "Node.js,");
    expect(onChange).toHaveBeenCalledWith(["Node.js"]);
  });

  it("does not add a duplicate tag", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput label="Skills" values={["TypeScript"]} onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "TypeScript{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput label="Skills" values={["TypeScript", "Node.js"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Remove TypeScript" }));
    expect(onChange).toHaveBeenCalledWith(["Node.js"]);
  });

  it("removes the last tag on Backspace when the draft is empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput label="Skills" values={["TypeScript", "Node.js"]} onChange={onChange} />);

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenCalledWith(["TypeScript"]);
  });
});
