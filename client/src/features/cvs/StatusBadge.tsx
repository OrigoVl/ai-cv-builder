import type { CvStatus } from "../../shared/types.js";

const STYLES: Record<CvStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  generating: "bg-amber-100 text-amber-700",
  ready: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const LABELS: Record<CvStatus, string> = {
  draft: "Draft",
  generating: "Generating…",
  ready: "Ready",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: CvStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>{LABELS[status]}</span>
  );
}
