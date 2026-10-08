import { Sparkles } from "lucide-react";

export function GeneratingState() {
  return (
    <div className="card flex flex-col items-center gap-4 py-14 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-100" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Sparkles className="h-6 w-6" />
        </span>
      </div>
      <div>
        <p className="font-medium text-gray-900">Drafting your CV…</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
          This usually takes under a minute. Feel free to close this tab — your progress is saved, and you can come
          back anytime from any device.
        </p>
      </div>
    </div>
  );
}
