// The click-to-edit title/role on CvDetailPage — covers the save/cancel/error branches that
// two real layout bugs (CvDetailPage.tsx's commit history) were found and fixed around, none of
// which were pinned down by a test before now.
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableField } from "./EditableField.js";

describe("EditableField", () => {
  it("renders the value as plain clickable text, not an input, by default", () => {
    render(<EditableField value="Developer" label="Target role" onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Edit Target role" })).toHaveTextContent("Developer");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("turns into a focused input, seeded with the current value, on click", async () => {
    const user = userEvent.setup();
    render(<EditableField value="Developer" label="Target role" onSave={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Target role" }));

    const input = screen.getByRole("textbox", { name: "Target role" });
    expect(input).toHaveValue("Developer");
    expect(input).toHaveFocus();
  });

  it("saves the trimmed value on Enter and returns to display mode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableField value="Developer" label="Target role" onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Edit Target role" }));
    const input = screen.getByRole("textbox", { name: "Target role" });
    await user.clear(input);
    await user.type(input, "  Staff Engineer  {Enter}");

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Staff Engineer"));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  it("saves on blur too, not just Enter", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <EditableField value="Developer" label="Target role" onSave={onSave} />
        <button>elsewhere</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Edit Target role" }));
    const input = screen.getByRole("textbox", { name: "Target role" });
    await user.clear(input);
    await user.type(input, "Staff Engineer");
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Staff Engineer"));
  });

  it("does not call onSave when the value is unchanged, and just exits edit mode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableField value="Developer" label="Target role" onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Edit Target role" }));
    await user.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("Escape reverts to the original value without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableField value="Developer" label="Target role" onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Edit Target role" }));
    await user.type(screen.getByRole("textbox", { name: "Target role" }), " extra text");
    await user.keyboard("{Escape}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Target role" })).toHaveTextContent("Developer");

    // Re-opening after Escape should show the original value, not the discarded draft.
    await user.click(screen.getByRole("button", { name: "Edit Target role" }));
    expect(screen.getByRole("textbox", { name: "Target role" })).toHaveValue("Developer");
  });

  it("rejects an empty value: shows an inline error and stays in edit mode", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableField value="Developer" label="Target role" onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Edit Target role" }));
    await user.clear(screen.getByRole("textbox", { name: "Target role" }));
    await user.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Can't be empty")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Target role" })).toBeInTheDocument();
  });

  it("on a failed save, shows an inline error and keeps the field open so the user can retry", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("network error"));
    render(<EditableField value="Developer" label="Target role" onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Edit Target role" }));
    const input = screen.getByRole("textbox", { name: "Target role" });
    await user.clear(input);
    await user.type(input, "Staff Engineer{Enter}");

    await waitFor(() => expect(screen.getByText("Couldn't save — try again")).toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Target role" })).toHaveValue("Staff Engineer");
  });

  it("caps input length at the given maxLength", async () => {
    const user = userEvent.setup();
    render(<EditableField value="CV" label="CV title" onSave={vi.fn()} maxLength={5} />);

    await user.click(screen.getByRole("button", { name: "Edit CV title" }));
    expect(screen.getByRole("textbox", { name: "CV title" })).toHaveAttribute("maxlength", "5");
  });
});
