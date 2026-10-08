import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** A textarea that grows to fit its content instead of clipping it or scrolling internally —
 * used wherever a fixed-height textarea has visibly cut off wrapped text (see BulletListEditor,
 * which is exactly the bug this was written to fix: a long bullet's second line was rendered
 * half-visible, sliced off by the box's fixed height, with no visual cue that more text existed). */
export function AutoGrowTextarea({
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return <textarea ref={ref} value={value} rows={1} {...props} />;
}
