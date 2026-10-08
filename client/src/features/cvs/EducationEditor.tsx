import type { EducationEntry } from "../../shared/types.js";

const EMPTY_ENTRY: EducationEntry = { institution: "", degree: "", field: "", startDate: "", endDate: "" };

export function EducationEditor({
  entries,
  onChange,
}: {
  entries: EducationEntry[];
  onChange: (entries: EducationEntry[]) => void;
}) {
  function update(i: number, patch: Partial<EducationEntry>) {
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function remove(i: number) {
    onChange(entries.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div key={i} className="rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Education {i + 1}</span>
            <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => remove(i)}>
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className="input" placeholder="Institution" value={entry.institution} onChange={(e) => update(i, { institution: e.target.value })} />
            <input className="input" placeholder="Degree" value={entry.degree} onChange={(e) => update(i, { degree: e.target.value })} />
            <input className="input" placeholder="Field of study" value={entry.field} onChange={(e) => update(i, { field: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" placeholder="Start" value={entry.startDate} onChange={(e) => update(i, { startDate: e.target.value })} />
              <input className="input" placeholder="End" value={entry.endDate} onChange={(e) => update(i, { endDate: e.target.value })} />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => onChange([...entries, { ...EMPTY_ENTRY }])}>
        + Add education
      </button>
    </div>
  );
}
