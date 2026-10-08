import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

/** Per-bullet rows with reorder/remove, instead of a single "one bullet per line" textarea —
 * keyboard-operable (unlike drag-and-drop) and makes each bullet's own actions discoverable. */
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
          <div key={i} className="flex items-start gap-1.5">
            <textarea
              aria-label={`Bullet point ${i + 1}`}
              className="textarea min-h-[42px] flex-1 py-2"
              rows={1}
              value={bullet}
              onChange={(e) => update(i, e.target.value)}
            />
            <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
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
            </div>
            <button
              type="button"
              className="btn-ghost btn-icon btn-sm mt-0.5 shrink-0 hover:!bg-red-50 hover:!text-red-600"
              onClick={() => remove(i)}
              aria-label="Remove bullet"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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
