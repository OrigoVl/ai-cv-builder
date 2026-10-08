import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Briefcase, GraduationCap, Link2, Mail, MapPin, Phone, Sparkles, User } from "lucide-react";
import { TagInput } from "../../shared/TagInput.js";
import { ExperienceEditor } from "./ExperienceEditor.js";
import { EducationEditor } from "./EducationEditor.js";
import { SaveStatus } from "./SaveStatus.js";
import type { CvDraft } from "./useCvDraft.js";

function SectionHeading({ icon: Icon, children }: { icon: typeof User; children: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
      <Icon className="h-4 w-4 text-brand-500" aria-hidden="true" />
      {children}
    </h3>
  );
}

function IconInput({
  icon: Icon,
  label,
  ...props
}: { icon: typeof User; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" aria-hidden="true" />
      <input id={id} className="input pl-10" {...props} />
    </div>
  );
}

export function CvEditor({ draft }: { draft: CvDraft }) {
  const { content, patch, saveState, reload } = draft;

  return (
    <div className="card divide-y divide-gray-100">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-base font-semibold text-gray-900">Edit your CV</h2>
        <div aria-live="polite">
          <SaveStatus state={saveState} onReload={reload} />
        </div>
      </div>

      <section className="py-5">
        <SectionHeading icon={User}>Contact</SectionHeading>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <IconInput
            icon={User}
            label="Full name"
            placeholder="Full name"
            value={content.contact.name}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, name: e.target.value } })}
          />
          <IconInput
            icon={Mail}
            label="Email"
            type="email"
            placeholder="Email"
            value={content.contact.email}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, email: e.target.value } })}
          />
          <IconInput
            icon={Phone}
            label="Phone"
            type="tel"
            placeholder="Phone"
            value={content.contact.phone}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, phone: e.target.value } })}
          />
          <IconInput
            icon={MapPin}
            label="Location"
            placeholder="Location"
            value={content.contact.location}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, location: e.target.value } })}
          />
        </div>
        <div className="mt-2.5">
          <TagInput
            label="Links"
            icon={Link2}
            placeholder="Add a link (portfolio, LinkedIn, GitHub…)"
            values={content.contact.links}
            onChange={(links) => patch({ ...content, contact: { ...content.contact, links } })}
          />
        </div>
      </section>

      <section className="py-5">
        <SectionHeading icon={Sparkles}>Summary</SectionHeading>
        <label htmlFor="cv-summary" className="sr-only">
          Summary
        </label>
        <textarea
          id="cv-summary"
          className="textarea min-h-[90px]"
          value={content.summary}
          onChange={(e) => patch({ ...content, summary: e.target.value })}
        />
      </section>

      <section className="py-5">
        <SectionHeading icon={Briefcase}>Experience</SectionHeading>
        <ExperienceEditor entries={content.experience} onChange={(experience) => patch({ ...content, experience })} />
      </section>

      <section className="py-5">
        <SectionHeading icon={GraduationCap}>Education</SectionHeading>
        <EducationEditor entries={content.education} onChange={(education) => patch({ ...content, education })} />
      </section>

      <section className="pt-5">
        <SectionHeading icon={Sparkles}>Skills</SectionHeading>
        <TagInput
          label="Skills"
          placeholder="Add a skill, e.g. TypeScript"
          values={content.skills}
          onChange={(skills) => patch({ ...content, skills })}
        />
      </section>
    </div>
  );
}
