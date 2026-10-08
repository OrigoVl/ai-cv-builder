import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { AutoGrowTextarea } from "./AutoGrowTextarea.js";

/** Per-bullet rows with reorder/remove, instead of a single "one bullet per line" textarea —
 * keyboard-operable (unlike drag-and-drop) and makes each bullet's own actions discoverable.
 * Each row is a borderless, auto-growing textarea inside a light card, so a long bullet that
 * wraps to 2-3 lines is never clipped — it was previously fixed at one line's height. */
export function BulletListEditor({ bullets, onChange }: { bullets: string[]; onChange: (bullets: string[]) => void }) {
  function update(i: number, value: string) {
    onChange(bullets.map((b, idx) => (idx === i ? value : b)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= bullets.length) return;
    const next = [...bullets];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }
  function remove(i: number) {
    onChange(bullets.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <span className="label">Bullet points</span>
      <div className="space-y-1.5">
        {bullets.map((bullet, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/60 py-2 pl-3 pr-1.5 focus-within:border-brand-200 focus-within:bg-white"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-300" aria-hidden="true" />
            <AutoGrowTextarea
              aria-label={`Bullet point ${i + 1}`}
              className="flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 py-0.5 text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0"
              value={bullet}
              onChange={(e) => update(i, e.target.value)}
            />
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                className="btn-ghost btn-icon btn-sm"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move bullet up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="btn-ghost btn-icon btn-sm"
                onClick={() => move(i, 1)}
                disabled={i === bullets.length - 1}
                aria-label="Move bullet down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="btn-ghost btn-icon btn-sm hover:!bg-red-50 hover:!text-red-600"
                onClick={() => remove(i)}
                aria-label="Remove bullet"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => onChange([...bullets, ""])}>
        <Plus className="h-3.5 w-3.5" />
        Add bullet
      </button>
    </div>
  );
}
