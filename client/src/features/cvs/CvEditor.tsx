import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, GraduationCap, Link2, Mail, MapPin, Phone, Sparkles, User } from "lucide-react";
import type { Cv, CvContent } from "../../shared/types.js";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";
import { useUpdateCv } from "../../shared/queries/cvs.js";
import { cvKeys } from "../../shared/queries/keys.js";
import { ApiError } from "../../shared/api.js";
import { useDebouncedCallback } from "../../shared/use-debounced-callback.js";
import { ExperienceEditor } from "./ExperienceEditor.js";
import { EducationEditor } from "./EducationEditor.js";
import { SaveStatus, type SaveState } from "./SaveStatus.js";

function SectionHeading({ icon: Icon, children }: { icon: typeof User; children: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
      <Icon className="h-4 w-4 text-brand-500" />
      {children}
    </h3>
  );
}

function IconInput({
  icon: Icon,
  ...props
}: { icon: typeof User } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
      <input className="input pl-10" {...props} />
    </div>
  );
}

export function CvEditor({ cv }: { cv: Cv }) {
  const qc = useQueryClient();
  const updateCv = useUpdateCv(cv.id);

  const [content, setContent] = useState<CvContent>(cv.content ?? EMPTY_CV_CONTENT);
  const [baseVersion, setBaseVersion] = useState(cv.version);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Content changed on the server (e.g. a question's answer was just merged in) without us
  // having unsaved local edits in flight — safe to pick up the new baseline automatically.
  useEffect(() => {
    if (!dirty && cv.version !== baseVersion) {
      setContent(cv.content ?? EMPTY_CV_CONTENT);
      setBaseVersion(cv.version);
    }
  }, [cv.version, cv.content, dirty, baseVersion]);

  const debouncedSave = useDebouncedCallback((next: CvContent, version: number) => {
    setSaveState("saving");
    updateCv.mutate(
      { content: next, version },
      {
        onSuccess: (data) => {
          setBaseVersion(data.cv.version);
          setDirty(false);
          setSaveState("saved");
        },
        onError: (err) => {
          setSaveState(err instanceof ApiError && err.status === 409 ? "conflict" : "error");
        },
      },
    );
  }, 700);

  function patch(next: CvContent) {
    setContent(next);
    setDirty(true);
    debouncedSave(next, baseVersion);
  }

  function reload() {
    qc.invalidateQueries({ queryKey: cvKeys.detail(cv.id) });
    setDirty(false);
    setSaveState("idle");
  }

  return (
    <div className="card divide-y divide-gray-100">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-base font-semibold text-gray-900">Edit your CV</h2>
        <SaveStatus state={saveState} onReload={reload} />
      </div>

      <section className="py-5">
        <SectionHeading icon={User}>Contact</SectionHeading>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <IconInput
            icon={User}
            placeholder="Full name"
            value={content.contact.name}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, name: e.target.value } })}
          />
          <IconInput
            icon={Mail}
            placeholder="Email"
            value={content.contact.email}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, email: e.target.value } })}
          />
          <IconInput
            icon={Phone}
            placeholder="Phone"
            value={content.contact.phone}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, phone: e.target.value } })}
          />
          <IconInput
            icon={MapPin}
            placeholder="Location"
            value={content.contact.location}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, location: e.target.value } })}
          />
        </div>
        <div className="mt-2.5">
          <IconInput
            icon={Link2}
            placeholder="Links, comma-separated (portfolio, LinkedIn, GitHub…)"
            value={content.contact.links.join(", ")}
            onChange={(e) =>
              patch({
                ...content,
                contact: {
                  ...content.contact,
                  links: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                },
              })
            }
          />
        </div>
      </section>

      <section className="py-5">
        <SectionHeading icon={Sparkles}>Summary</SectionHeading>
        <textarea
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
        <input
          className="input"
          placeholder="Comma-separated, e.g. TypeScript, PostgreSQL, Kubernetes"
          value={content.skills.join(", ")}
          onChange={(e) => patch({ ...content, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </section>
    </div>
  );
}
