import { useRef, useState, type DragEvent } from "react";
import { FileText, Upload, X } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  file,
  onChange,
  accept = "application/pdf",
  maxSizeBytes = 5 * 1024 * 1024,
  hint = "PDF with selectable text, up to 5MB",
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSizeBytes?: number;
  hint?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(candidate: File | undefined) {
    if (!candidate) return;
    if (candidate.type !== accept) {
      setError("Please choose a PDF file.");
      return;
    }
    if (candidate.size > maxSizeBytes) {
      setError(`That file is larger than ${formatBytes(maxSizeBytes)}.`);
      return;
    }
    setError(null);
    onChange(candidate);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
          <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors
          ${isDragging ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-gray-50/60 hover:border-gray-300 hover:bg-gray-50"}`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft">
          <Upload className="h-5 w-5 text-brand-500" />
        </div>
        <p className="text-sm font-medium text-gray-700">
          <span className="text-brand-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-400">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          aria-label="CV PDF file"
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
