import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { ExperienceEntry } from "../../shared/types.js";
import { BulletListEditor } from "../../shared/BulletListEditor.js";

const EMPTY_ENTRY: ExperienceEntry = { company: "", title: "", location: "", startDate: "", endDate: "", bullets: [] };

export function ExperienceEditor({
  entries,
  onChange,
}: {
  entries: ExperienceEntry[];
  onChange: (entries: ExperienceEntry[]) => void;
}) {
  function update(i: number, patch: Partial<ExperienceEntry>) {
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }
  function remove(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-400">
          No experience yet — add a position below.
        </p>
      )}
      {entries.map((entry, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Position {i + 1}</span>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn-ghost btn-icon btn-sm"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-ghost btn-icon btn-sm"
                onClick={() => move(i, 1)}
                disabled={i === entries.length - 1}
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-ghost btn-icon btn-sm hover:!bg-red-50 hover:!text-red-600"
                onClick={() => remove(i)}
                aria-label="Remove position"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <input className="input" placeholder="Job title" value={entry.title} onChange={(e) => update(i, { title: e.target.value })} />
            <input className="input" placeholder="Company" value={entry.company} onChange={(e) => update(i, { company: e.target.value })} />
            <input className="input" placeholder="Location" value={entry.location} onChange={(e) => update(i, { location: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" placeholder="Start" value={entry.startDate} onChange={(e) => update(i, { startDate: e.target.value })} />
              <input className="input" placeholder="End (or Present)" value={entry.endDate} onChange={(e) => update(i, { endDate: e.target.value })} />
            </div>
          </div>
          <div className="mt-3">
            <BulletListEditor bullets={entry.bullets} onChange={(bullets) => update(i, { bullets })} />
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary w-full" onClick={() => onChange([...entries, { ...EMPTY_ENTRY }])}>
        <Plus className="h-4 w-4" />
        Add experience
      </button>
    </div>
  );
}
