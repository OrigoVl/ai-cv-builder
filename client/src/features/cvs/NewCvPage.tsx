import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft, FileUp, Lightbulb, Sparkles, Type } from "lucide-react";
import { useCreateCv } from "../../shared/queries/cvs.js";
import { ApiError } from "../../shared/api.js";
import { FileDropzone } from "../../shared/FileDropzone.js";
import { Spinner } from "../../shared/Spinner.js";

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
    <div className="mx-auto max-w-xl space-y-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Back to your CVs
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">New CV</h1>
        <p className="mt-0.5 text-sm text-gray-500">A couple of details, then the AI takes a first pass.</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <label className="label" htmlFor="title">
            Title <span className="font-normal text-gray-400">(optional, just for your own list)</span>
          </label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend CV"
          />
        </div>

        <div>
          <label className="label" htmlFor="targetRole">
            Target role
          </label>
          <input
            id="targetRole"
            className="input"
            required
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
          />
          <p className="help-text">The summary and bullet order are tailored to this.</p>
        </div>

        <div>
          <span className="label">Your background</span>
          <div className="segmented mb-3">
            <button
              type="button"
              className={`segmented-option ${mode === "pdf" ? "segmented-option-active" : ""}`}
              onClick={() => setMode("pdf")}
            >
              <FileUp className="h-4 w-4" />
              Upload PDF
            </button>
            <button
              type="button"
              className={`segmented-option ${mode === "text" ? "segmented-option-active" : ""}`}
              onClick={() => setMode("text")}
            >
              <Type className="h-4 w-4" />
              Describe yourself
            </button>
          </div>

          {mode === "pdf" ? (
            <FileDropzone file={file} onChange={setFile} />
          ) : (
            <textarea
              id="sourceText"
              className="textarea min-h-[160px]"
              placeholder="Paste or write your background: roles, companies, dates, achievements…"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          )}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-brand-50/70 px-3.5 py-3 text-xs text-brand-800">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <p>
            More detail in, better CV out — include real dates, numbers, and outcomes where you can. Anything
            missing gets asked as a quick question afterwards, rather than guessed.
          </p>
        </div>

        {error && <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>}

        <button className="btn-primary w-full" type="submit" disabled={!canSubmit || createCv.isPending}>
          {createCv.isPending ? (
            <Spinner />
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate CV
            </>
          )}
        </button>
      </form>
    </div>
  );
}
