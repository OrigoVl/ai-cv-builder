import { AlertTriangle, Check } from "lucide-react";
import { Spinner } from "../../shared/Spinner.js";

export type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

export function SaveStatus({ state, onReload }: { state: SaveState; onReload: () => void }) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
        <Spinner size={12} /> Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
        <Check className="h-3.5 w-3.5" /> Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
        <AlertTriangle className="h-3.5 w-3.5" /> Couldn't save — check your connection
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
      <AlertTriangle className="h-3.5 w-3.5" />
      This CV changed elsewhere.{" "}
      <button className="font-medium underline" onClick={onReload}>
        Reload
      </button>
    </span>
  );
}
