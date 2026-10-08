import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCreateCv } from "../../shared/queries/cvs.js";
import { ApiError } from "../../shared/api.js";

export function NewCvPage() {
  const navigate = useNavigate();
  const createCv = useCreateCv();
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [title, setTitle] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const cv = await createCv.mutateAsync({
        title: title || targetRole || "My CV",
        targetRole,
        file: mode === "pdf" ? (file ?? undefined) : undefined,
        sourceText: mode === "text" ? sourceText : undefined,
      });
      navigate(`/cvs/${cv.cv.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  const canSubmit = targetRole.trim().length > 0 && (mode === "pdf" ? !!file : sourceText.trim().length > 0);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">New CV</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">Title (optional)</label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend CV"
          />
        </div>
        <div>
          <label className="label" htmlFor="targetRole">Target role</label>
          <input
            id="targetRole"
            className="input"
            required
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
          />
        </div>

        <div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className={mode === "pdf" ? "btn-primary" : "btn-secondary"}
              onClick={() => setMode("pdf")}
            >
              Upload PDF
            </button>
            <button
              type="button"
              className={mode === "text" ? "btn-primary" : "btn-secondary"}
              onClick={() => setMode("text")}
            >
              Describe yourself
            </button>
          </div>

          {mode === "pdf" ? (
            <div>
              <input
                type="file"
                aria-label="CV PDF file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">PDF with selectable text, up to 5MB.</p>
            </div>
          ) : (
            <textarea
              id="sourceText"
              className="input min-h-[160px]"
              placeholder="Paste or write your background: roles, companies, dates, achievements…"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn-primary w-full" type="submit" disabled={!canSubmit || createCv.isPending}>
          {createCv.isPending ? "Starting…" : "Generate CV"}
        </button>
      </form>
    </div>
  );
}
