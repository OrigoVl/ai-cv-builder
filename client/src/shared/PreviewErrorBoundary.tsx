import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/** React requires error boundaries to be class components — no hook equivalent exists. Scoped
 * tightly around the PDF preview so a rendering edge case there (react-pdf's layout engine
 * throwing on some unexpected content shape) can't take down the rest of the CV editor with it;
 * the user's actual data and the editor itself are completely unaffected either way, since the
 * preview only ever reads from state the editor owns. */
export class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Live preview failed to render:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-6 py-10 text-center">
          <AlertTriangle className="h-5 w-5 text-gray-400" />
          <p className="text-sm text-gray-500">
            Couldn't render the live preview right now. Your edits are still saved — try reloading.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
