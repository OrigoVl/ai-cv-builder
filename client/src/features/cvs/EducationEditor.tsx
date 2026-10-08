import { Plus, Trash2 } from "lucide-react";
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
      {entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-400">
          No education yet — add one below.
        </p>
      )}
      {entries.map((entry, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Education {i + 1}</span>
            <button
              type="button"
              className="btn-ghost btn-icon btn-sm hover:!bg-red-50 hover:!text-red-600"
              onClick={() => remove(i)}
              aria-label="Remove education"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
      <button type="button" className="btn-secondary w-full" onClick={() => onChange([...entries, { ...EMPTY_ENTRY }])}>
        <Plus className="h-4 w-4" />
        Add education
      </button>
    </div>
  );
}
