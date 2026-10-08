import { AlertCircle, CheckCircle2, FileEdit, Loader2 } from "lucide-react";
import type { CvStatus } from "../../shared/types.js";

const CONFIG: Record<CvStatus, { style: string; label: string; icon: typeof Loader2; spin?: boolean }> = {
  draft: { style: "bg-gray-100 text-gray-600", label: "Draft", icon: FileEdit },
  generating: { style: "bg-amber-50 text-amber-700", label: "Generating…", icon: Loader2, spin: true },
  ready: { style: "bg-green-50 text-green-700", label: "Ready", icon: CheckCircle2 },
  failed: { style: "bg-red-50 text-red-700", label: "Failed", icon: AlertCircle },
};

export function StatusBadge({ status }: { status: CvStatus }) {
  const { style, label, icon: Icon, spin } = CONFIG[status];
  return (
    <span className={`pill shrink-0 ${style}`}>
      <Icon className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
