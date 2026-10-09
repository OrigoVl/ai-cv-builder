// jsdom never runs real layout, so `scrollHeight` is always 0 unless stubbed — stubbing it per
// test is what makes the resize logic itself (not just "it renders") actually verifiable here.
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AutoGrowTextarea } from "./AutoGrowTextarea.js";

function stubScrollHeight(el: HTMLTextAreaElement, px: number) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: px });
}

describe("AutoGrowTextarea", () => {
  it("sets its height to match scrollHeight once a value change re-runs the resize effect", () => {
    function Wrapper({ value }: { value: string }) {
      return <AutoGrowTextarea value={value} onChange={vi.fn()} />;
    }
    const { container, rerender } = render(<Wrapper value="Some text" />);
    const textarea = container.querySelector("textarea")!;

    // scrollHeight is un-stubbed (0 in jsdom) on the initial mount; stub it, then change the
    // `value` prop so the effect (keyed on `value`) actually re-runs and reads it.
    stubScrollHeight(textarea, 84);
    rerender(<Wrapper value="Some text, now longer" />);

    expect(textarea.style.height).toBe("84px");
  });

  it("grows when the value grows to wrap onto more lines", () => {
    function Wrapper({ value }: { value: string }) {
      return <AutoGrowTextarea value={value} onChange={vi.fn()} />;
    }
    const { container, rerender } = render(<Wrapper value="One line" />);
    const textarea = container.querySelector("textarea")!;
    stubScrollHeight(textarea, 20);
    rerender(<Wrapper value="One line" />); // trigger the effect again with the stub in place
    const heightAfterShort = textarea.style.height;

    stubScrollHeight(textarea, 60);
    rerender(<Wrapper value="One line\nTwo lines\nThree lines now" />);

    expect(textarea.style.height).toBe("60px");
    expect(textarea.style.height).not.toBe(heightAfterShort);
  });

  it("starts at a single row and passes other textarea props through", () => {
    const { container } = render(
      <AutoGrowTextarea value="x" onChange={vi.fn()} placeholder="Type here" className="my-textarea" />,
    );
    const textarea = container.querySelector("textarea")!;
    expect(textarea).toHaveAttribute("rows", "1");
    expect(textarea).toHaveAttribute("placeholder", "Type here");
    expect(textarea).toHaveClass("my-textarea");
    expect(textarea).toHaveValue("x");
  });
});
