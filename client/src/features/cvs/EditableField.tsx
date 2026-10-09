import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Click-to-edit text (the CV title/target role on CvDetailPage): a plain-looking button that
 * turns into an input on click, saves on blur or Enter, and reverts on Escape. `className`
 * controls font size/weight so the edit state lines up with the heading it replaces instead of
 * jumping to a generic form-input size.
 */
export function EditableField({
  value,
  onSave,
  label,
  className = "",
  maxLength = 200,
}: {
  value: string;
  onSave: (value: string) => Promise<unknown>;
  label: string;
  className?: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    // Cursor at the end, not select-all: selecting the whole value on entry can trigger the
    // OS/browser's "translate selection" popup, which floats at a fixed viewport position and
    // looks like a stray UI glitch once the layout below it shifts.
    if (editing) {
      const el = inputRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  async function commit() {
    const next = draft.trim();
    if (!next) {
      setError("Can't be empty");
      return;
    }
    if (next === value) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      setError("Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  // Both branches render inside the same block-level wrapper so this field always occupies its
  // own line — title above role, same as the original <h1>/<p> stack — instead of the plain-text
  // button (inline-level) flowing next to its sibling field while the input (block, full-width)
  // forces a break, which is what was causing the layout to jump on click.
  return (
    <div className="max-w-full">
      {editing ? (
        <>
          <input
            ref={inputRef}
            // Width tracks the content length (in `ch`, roughly one character's width) instead of
            // stretching to fill the container, so switching into edit mode doesn't balloon the
            // field — and everything below it — sideways or downward.
            style={{ width: `${Math.min(Math.max(draft.length + 2, 6), maxLength)}ch` }}
            className={`max-w-full rounded-md border border-brand-300 bg-white px-1.5 py-0.5 outline-none ring-2 ring-brand-100 ${className}`}
            value={draft}
            maxLength={maxLength}
            aria-label={label}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            autoFocus
          />
          {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${label}`}
          title={`Click to edit ${label.toLowerCase()}`}
          className={`group -ml-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-gray-100 ${className}`}
        >
          <span className="truncate">{value}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
}
