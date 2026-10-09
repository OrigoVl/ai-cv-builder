import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileDropzone } from "./FileDropzone.js";

describe("FileDropzone", () => {
  it("accepts a PDF under the size limit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FileDropzone file={null} onChange={onChange} />);

    const file = new File(["pdf bytes"], "resume.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("rejects a file with the wrong MIME type, with a visible error, and does not call onChange", () => {
    const onChange = vi.fn();
    render(<FileDropzone file={null} onChange={onChange} />);

    // userEvent.upload enforces the input's `accept` filter like a real OS file picker would,
    // so a mismatched file never reaches it that way — fireEvent bypasses that, the same way a
    // real drag-and-drop (handleDrop, tested below) can hand over any file type regardless.
    const file = new File(["not a pdf"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Please choose a PDF file.");
  });

  it("rejects a file over the size limit, with a visible error, and does not call onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FileDropzone file={null} onChange={onChange} maxSizeBytes={1024} />);

    const big = new Uint8Array(2048);
    const file = new File([big], "resume.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("That file is larger than 1 KB.");
  });

  it("shows the selected file's name and size once accepted", () => {
    const file = new File(["x".repeat(2048)], "resume.pdf", { type: "application/pdf" });
    render(<FileDropzone file={file} onChange={vi.fn()} />);

    expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("clears the selected file when its remove button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const file = new File(["x"], "resume.pdf", { type: "application/pdf" });
    render(<FileDropzone file={file} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Remove file" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("accepts a dropped file via the drop zone, same as a click-to-browse selection", () => {
    const onChange = vi.fn();
    render(<FileDropzone file={null} onChange={onChange} />);

    const file = new File(["pdf bytes"], "resume.pdf", { type: "application/pdf" });
    const dropzone = screen.getByRole("button", { name: /Upload a CV PDF/ });
    const dataTransfer = { files: [file] };

    // fireEvent (not userEvent) here: userEvent has no built-in drag-and-drop simulation, and a
    // raw DragEvent needs an explicit dataTransfer payload set by the test itself.
    dropzone.dispatchEvent(
      Object.assign(new Event("drop", { bubbles: true, cancelable: true }), { dataTransfer }),
    );

    expect(onChange).toHaveBeenCalledWith(file);
  });
});
