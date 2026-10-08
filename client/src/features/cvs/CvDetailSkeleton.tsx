export function CvDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-4 w-32 rounded bg-gray-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-gray-100" />
      </div>
      <div className="card space-y-4">
        <div className="h-4 w-24 rounded bg-gray-100" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
          <div className="h-10 rounded-xl bg-gray-100" />
        </div>
        <div className="h-4 w-20 rounded bg-gray-100" />
        <div className="h-20 rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}
