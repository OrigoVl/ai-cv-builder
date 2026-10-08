import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Cv, CvContent } from "../../shared/types.js";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";
import { useUpdateCv } from "../../shared/queries/cvs.js";
import { cvKeys } from "../../shared/queries/keys.js";
import { ApiError } from "../../shared/api.js";
import { useDebouncedCallback } from "../../shared/use-debounced-callback.js";
import { ExperienceEditor } from "./ExperienceEditor.js";
import { EducationEditor } from "./EducationEditor.js";
import { SaveStatus, type SaveState } from "./SaveStatus.js";

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
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500">Edit your CV</h2>
        <SaveStatus state={saveState} onReload={reload} />
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Contact</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            className="input"
            placeholder="Full name"
            value={content.contact.name}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, name: e.target.value } })}
          />
          <input
            className="input"
            placeholder="Email"
            value={content.contact.email}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, email: e.target.value } })}
          />
          <input
            className="input"
            placeholder="Phone"
            value={content.contact.phone}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, phone: e.target.value } })}
          />
          <input
            className="input"
            placeholder="Location"
            value={content.contact.location}
            onChange={(e) => patch({ ...content, contact: { ...content.contact, location: e.target.value } })}
          />
        </div>
        <label className="label mt-2">Links (comma-separated)</label>
        <input
          className="input"
          value={content.contact.links.join(", ")}
          onChange={(e) =>
            patch({
              ...content,
              contact: { ...content.contact, links: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) },
            })
          }
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Summary</h3>
        <textarea
          className="input min-h-[80px]"
          value={content.summary}
          onChange={(e) => patch({ ...content, summary: e.target.value })}
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Experience</h3>
        <ExperienceEditor entries={content.experience} onChange={(experience) => patch({ ...content, experience })} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Education</h3>
        <EducationEditor entries={content.education} onChange={(education) => patch({ ...content, education })} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Skills</h3>
        <label className="label">Comma-separated</label>
        <input
          className="input"
          value={content.skills.join(", ")}
          onChange={(e) => patch({ ...content, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </section>
    </div>
  );
}
