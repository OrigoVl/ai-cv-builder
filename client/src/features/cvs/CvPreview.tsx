import type { CvContent, CvTemplate } from "../../shared/types.js";

function dateRange(start: string, end: string): string {
  if (!start && !end) return "";
  return [start || "?", end || "Present"].join(" – ");
}

/**
 * A live, read-only HTML rendering of the CV being edited — same data as the PDF export, updated
 * on every keystroke (it reads straight from useCvDraft's `content`, the same state CvEditor
 * writes to). This is what makes editing feel direct instead of blind: previously the only way
 * to see your changes rendered was to download the PDF.
 *
 * Deliberately NOT pixel-identical to the PDF (that's @react-pdf/renderer's job, a completely
 * separate renderer — see server/src/pdf/templates/) — this is an approximation close enough to
 * preview layout and content, not a second source of truth for what gets downloaded.
 */
export function CvPreview({ content, template }: { content: CvContent; template: CvTemplate }) {
  return (
    <div className="sticky top-20">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500">Live preview</h2>
      </div>
      <div className="aspect-[210/297] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-card">
        {template === "modern" ? <ModernPreview content={content} /> : <ClassicPreview content={content} />}
      </div>
    </div>
  );
}

function ClassicPreview({ content }: { content: CvContent }) {
  const { contact, summary, experience, education, skills } = content;
  const contactParts = [contact.email, contact.phone, contact.location, ...contact.links].filter(Boolean);

  return (
    <div className="p-6 text-[10px] leading-snug text-gray-900">
      <h1 className="text-lg font-bold">{contact.name || "Untitled CV"}</h1>
      {contactParts.length > 0 && (
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-gray-500">
          {contactParts.map((part, i) => (
            <span key={i}>{part}</span>
          ))}
        </p>
      )}

      {summary && (
        <section className="mt-3">
          <h2 className="border-b border-gray-200 pb-1 text-[9px] font-bold uppercase tracking-wide text-gray-700">
            Summary
          </h2>
          <p className="mt-1.5 text-gray-700">{summary}</p>
        </section>
      )}

      {experience.length > 0 && (
        <section className="mt-3">
          <h2 className="border-b border-gray-200 pb-1 text-[9px] font-bold uppercase tracking-wide text-gray-700">
            Experience
          </h2>
          {experience.map((entry, i) => (
            <div key={i} className="mt-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">
                  {entry.title}
                  {entry.title && entry.company ? " · " : ""}
                  {entry.company}
                </p>
                <p className="shrink-0 text-gray-400">{dateRange(entry.startDate, entry.endDate)}</p>
              </div>
              {entry.location && <p className="text-gray-500">{entry.location}</p>}
              {entry.bullets.map((bullet, j) => (
                <p key={j} className="mt-0.5 flex gap-1.5 text-gray-700">
                  <span>•</span>
                  <span>{bullet}</span>
                </p>
              ))}
            </div>
          ))}
        </section>
      )}

      {education.length > 0 && (
        <section className="mt-3">
          <h2 className="border-b border-gray-200 pb-1 text-[9px] font-bold uppercase tracking-wide text-gray-700">
            Education
          </h2>
          {education.map((entry, i) => (
            <div key={i} className="mt-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">
                  {entry.degree}
                  {entry.degree && entry.field ? ", " : ""}
                  {entry.field}
                </p>
                <p className="shrink-0 text-gray-400">{dateRange(entry.startDate, entry.endDate)}</p>
              </div>
              <p className="text-gray-500">{entry.institution}</p>
            </div>
          ))}
        </section>
      )}

      {skills.length > 0 && (
        <section className="mt-3">
          <h2 className="border-b border-gray-200 pb-1 text-[9px] font-bold uppercase tracking-wide text-gray-700">
            Skills
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {skills.map((skill, i) => (
              <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ModernPreview({ content }: { content: CvContent }) {
  const { contact, summary, experience, education, skills } = content;
  const sidebarContact = [contact.email, contact.phone, contact.location, ...contact.links].filter(Boolean);

  return (
    <div className="flex h-full text-[10px] leading-snug">
      <div className="w-[34%] shrink-0 bg-brand-600 p-4 text-white">
        <h1 className="text-sm font-bold leading-tight">{contact.name || "Untitled CV"}</h1>

        {sidebarContact.length > 0 && (
          <div className="mt-3">
            <h2 className="text-[8.5px] font-bold uppercase tracking-wide text-brand-200">Contact</h2>
            {sidebarContact.map((line, i) => (
              <p key={i} className="mt-1 text-brand-50">
                {line}
              </p>
            ))}
          </div>
        )}

        {skills.length > 0 && (
          <div className="mt-3">
            <h2 className="text-[8.5px] font-bold uppercase tracking-wide text-brand-200">Skills</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              {skills.map((skill, i) => (
                <span key={i} className="rounded bg-white/15 px-1.5 py-0.5 text-[9px]">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {education.length > 0 && (
          <div className="mt-3">
            <h2 className="text-[8.5px] font-bold uppercase tracking-wide text-brand-200">Education</h2>
            {education.map((entry, i) => (
              <div key={i} className="mt-1.5">
                <p className="font-bold text-brand-50">
                  {entry.degree}
                  {entry.degree && entry.field ? ", " : ""}
                  {entry.field}
                </p>
                <p className="text-brand-100">{entry.institution}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 p-4">
        {summary && (
          <section>
            <h2 className="text-[9px] font-bold uppercase tracking-wide text-brand-600">Summary</h2>
            <p className="mt-1.5 text-gray-700">{summary}</p>
          </section>
        )}

        {experience.length > 0 && (
          <section className="mt-3">
            <h2 className="text-[9px] font-bold uppercase tracking-wide text-brand-600">Experience</h2>
            {experience.map((entry, i) => (
              <div key={i} className="mt-2">
                <p className="font-bold">{entry.title}</p>
                <p className="text-gray-500">
                  {entry.company}
                  {entry.company && entry.location ? " · " : ""}
                  {entry.location}
                </p>
                <p className="text-gray-400">{dateRange(entry.startDate, entry.endDate)}</p>
                {entry.bullets.map((bullet, j) => (
                  <p key={j} className="mt-0.5 flex gap-1.5 text-gray-700">
                    <span className="text-brand-500">•</span>
                    <span>{bullet}</span>
                  </p>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
