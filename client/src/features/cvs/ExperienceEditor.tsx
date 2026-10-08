import type { ExperienceEntry } from "../../shared/types.js";

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
      {entries.map((entry, i) => (
        <div key={i} className="rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Position {i + 1}</span>
            <div className="flex gap-1">
              <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </button>
              <button
                type="button"
                className="btn-secondary px-2 py-1 text-xs"
                onClick={() => move(i, 1)}
                disabled={i === entries.length - 1}
              >
                ↓
              </button>
              <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => remove(i)}>
                Remove
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Job title" value={entry.title} onChange={(e) => update(i, { title: e.target.value })} />
            <input className="input" placeholder="Company" value={entry.company} onChange={(e) => update(i, { company: e.target.value })} />
            <input className="input" placeholder="Location" value={entry.location} onChange={(e) => update(i, { location: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" placeholder="Start" value={entry.startDate} onChange={(e) => update(i, { startDate: e.target.value })} />
              <input className="input" placeholder="End (or Present)" value={entry.endDate} onChange={(e) => update(i, { endDate: e.target.value })} />
            </div>
          </div>
          <label className="label mt-2">Bullet points (one per line)</label>
          <textarea
            className="input min-h-[90px]"
            value={entry.bullets.join("\n")}
            onChange={(e) => update(i, { bullets: e.target.value.split("\n") })}
          />
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => onChange([...entries, { ...EMPTY_ENTRY }])}>
        + Add experience
      </button>
    </div>
  );
}
