import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  icon: Icon,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  icon?: typeof X;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (!value) return;
    if (!values.includes(value)) onChange([...values, value]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="input flex min-h-[44px] flex-wrap items-center gap-1.5 py-1.5">
        {Icon && <Icon className="ml-0.5 h-4 w-4 shrink-0 text-gray-300" />}
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="rounded-sm hover:text-brand-900"
              aria-label={`Remove ${value}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 border-0 bg-transparent p-0.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
        />
      </div>
      <p className="help-text">Press Enter or comma to add.</p>
    </div>
  );
}
