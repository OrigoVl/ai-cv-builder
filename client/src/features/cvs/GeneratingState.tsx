export function GeneratingState() {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <div>
        <p className="font-medium">Generating your CV…</p>
        <p className="mt-1 text-sm text-gray-500">
          This can take up to a minute. Feel free to leave this page — your progress is saved, and you can come back
          anytime.
        </p>
      </div>
    </div>
  );
}
