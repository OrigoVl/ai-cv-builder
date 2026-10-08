import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Cv, CvContent } from "../../shared/types.js";
import { EMPTY_CV_CONTENT } from "../../shared/types.js";
import { useUpdateCv } from "../../shared/queries/cvs.js";
import { cvKeys } from "../../shared/queries/keys.js";
import { ApiError } from "../../shared/api.js";
import { useDebouncedCallback } from "../../shared/use-debounced-callback.js";
import type { SaveState } from "./SaveStatus.js";

/**
 * Single source of truth for "the CV content currently being edited" — pulled out of CvEditor so
 * CvDetailPage can hand the same live `content` to both the form (CvEditor) and the read-only
 * live preview (CvPreview) without duplicating the debounce/CAS/conflict logic or risking the two
 * drifting out of sync with each other.
 */
export function useCvDraft(cv: Cv) {
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

  return { content, patch, saveState, reload };
}

export type CvDraft = ReturnType<typeof useCvDraft>;
