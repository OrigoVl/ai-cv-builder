export type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

export function SaveStatus({ state, onReload }: { state: SaveState; onReload: () => void }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="text-xs text-gray-400">Saving…</span>;
  if (state === "saved") return <span className="text-xs text-green-600">Saved</span>;
  if (state === "error") return <span className="text-xs text-red-600">Couldn't save — check your connection</span>;
  return (
    <span className="text-xs text-red-600">
      This CV changed elsewhere.{" "}
      <button className="underline" onClick={onReload}>
        Reload
      </button>
    </span>
  );
}
