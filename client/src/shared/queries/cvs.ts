import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { cvKeys } from "./keys.js";
import type { Cv, CvContent, CvQuestion, CvTemplate } from "../types.js";

export function useCvs() {
  return useQuery({
    queryKey: cvKeys.list,
    queryFn: () => api.get<{ cvs: Cv[] }>("/cvs"),
  });
}

export interface CvDetail {
  cv: Cv;
  questions: CvQuestion[];
}

/**
 * Polls every 1.5s while generation is in flight — this is what makes "reloading the page
 * doesn't lose track of progress" true: there's no client-side job state at all, just this
 * query re-reading the CV's `status` column until it leaves "generating". A page reload just
 * re-mounts the query and it picks up exactly where the server already is.
 *
 * Polling doesn't stop once the CV is "ready", though — just slows to every 5s. Answering a
 * question also runs asynchronously (the apply_answer job), so `version`/`content` can still
 * change on the server after the status leaves "generating"; without this the editor's cached
 * version could go stale and every save would 409 until a manual reload. The slow background
 * poll is safe to leave running: CvEditor only ever applies a refetched version while the user
 * has no unsaved local edit (its `dirty` check), so this can't clobber in-progress typing.
 */
export function useCv(id: string | undefined) {
  return useQuery({
    queryKey: cvKeys.detail(id ?? ""),
    queryFn: () => api.get<CvDetail>(`/cvs/${id}`),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.cv.status === "generating" ? 1500 : 5000),
  });
}

export function useCreateCv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; targetRole: string; sourceText?: string; file?: File }) => {
      const form = new FormData();
      form.set("title", input.title);
      form.set("targetRole", input.targetRole);
      if (input.file) form.set("file", input.file);
      else if (input.sourceText) form.set("sourceText", input.sourceText);
      return api.post<{ cv: Cv }>("/cvs", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cvKeys.list }),
  });
}

export function useUpdateCv(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: CvContent; version: number }) => api.put<{ cv: Cv }>(`/cvs/${id}`, input),
    onSuccess: (data) => {
      qc.setQueryData<CvDetail>(cvKeys.detail(id), (prev) => (prev ? { ...prev, cv: data.cv } : prev));
    },
  });
}

export function useDeleteCv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/cvs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: cvKeys.list }),
  });
}

export function useRetryCv(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ cv: Cv }>(`/cvs/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: cvKeys.detail(id) }),
  });
}

export function useAnswerQuestion(cvId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      api.post(`/cvs/${cvId}/questions/${questionId}/answer`, { answer }),
    onSuccess: () => {
      // The 202 response only means the apply_answer job was ENQUEUED, not that it's finished
      // merging the answer into `content`/`version` yet — this refetch mostly just clears the
      // question from the panel right away. A second refetch shortly after gives the (usually
      // sub-second) merge job time to land before the slow background poll (useCv) would catch
      // it, so the editor isn't left holding a stale version in the meantime.
      qc.invalidateQueries({ queryKey: cvKeys.detail(cvId) });
      setTimeout(() => qc.invalidateQueries({ queryKey: cvKeys.detail(cvId) }), 1500);
    },
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: CvTemplate) => api.put<{ cv: Cv }>(`/cvs/${id}/template`, { template }),
    onSuccess: (data) => {
      qc.setQueryData<CvDetail>(cvKeys.detail(id), (prev) => (prev ? { ...prev, cv: data.cv } : prev));
    },
  });
}

export function useDismissQuestion(cvId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => api.post(`/cvs/${cvId}/questions/${questionId}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: cvKeys.detail(cvId) }),
  });
}
