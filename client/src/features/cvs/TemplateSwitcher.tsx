import { useUpdateTemplate } from "../../shared/queries/cvs.js";
import type { CvTemplate } from "../../shared/types.js";

const OPTIONS: { value: CvTemplate; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "modern", label: "Modern" },
];

export function TemplateSwitcher({ cvId, current }: { cvId: string; current: CvTemplate }) {
  const updateTemplate = useUpdateTemplate(cvId);

  return (
    <div role="radiogroup" aria-label="CV template" className="segmented">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={current === opt.value}
          className={`segmented-option ${current === opt.value ? "segmented-option-active" : ""}`}
          onClick={() => opt.value !== current && updateTemplate.mutate(opt.value)}
          disabled={updateTemplate.isPending}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
