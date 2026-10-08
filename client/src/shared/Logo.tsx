// The Brightfolio mark: a "page" with a sparkle at its corner — the AI drafts the page, the
// spark is the small amount of generated gloss on top of your own, real content. Kept as inline
// SVG (not an <img src="/favicon.svg">) so it can recolor/resize per use without extra requests.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bf-page" x1="4" y1="5" x2="23" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C6FF0" />
          <stop offset="1" stopColor="#5B4FD9" />
        </linearGradient>
        <linearGradient id="bf-spark" x1="17" y1="2" x2="31" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC861" />
          <stop offset="1" stopColor="#F6A623" />
        </linearGradient>
      </defs>
      <rect x="4" y="5" width="19" height="23" rx="3.5" fill="url(#bf-page)" />
      <rect x="8" y="12" width="11" height="2" rx="1" fill="white" fillOpacity="0.9" />
      <rect x="8" y="16.5" width="11" height="2" rx="1" fill="white" fillOpacity="0.55" />
      <rect x="8" y="21" width="7.5" height="2" rx="1" fill="white" fillOpacity="0.55" />
      <path
        d="M24.5 2C25.4 6.2 27.7 8.6 32 9.5C27.7 10.4 25.4 12.8 24.5 17C23.6 12.8 21.3 10.4 17 9.5C21.3 8.6 23.6 6.2 24.5 2Z"
        fill="url(#bf-spark)"
      />
    </svg>
  );
}

export function Logo({
  size = 28,
  wordmark = true,
  tone = "light",
}: {
  size?: number;
  wordmark?: boolean;
  /** "light" = for a white/light background (dark text). "dark" = for the brand-gradient panel
   * (white text) — getting this wrong is how a wordmark goes invisible against its own background. */
  tone?: "light" | "dark";
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      {wordmark && (
        <span className={`text-lg font-semibold tracking-tight ${tone === "dark" ? "text-white" : "text-gray-900"}`}>
          Bright
          <span className={tone === "dark" ? "text-accent-400" : "text-brand-600"}>folio</span>
        </span>
      )}
    </span>
  );
}
