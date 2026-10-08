import { useId, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

interface PasswordInputProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  helpText?: string;
}

/** A password field with a show/hide toggle — the one input type where "just use a plain
 * <input>" visibly costs usability (no way to check what you typed before submitting). */
export function PasswordInput({ id, label, value, onChange, autoComplete, minLength, helpText }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          id={inputId}
          className="input pl-10 pr-10"
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-600"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {helpText && <p className="help-text">{helpText}</p>}
    </div>
  );
}
