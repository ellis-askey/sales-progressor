// The branded route loader: the Sales Progressor mark breathing over a soft
// ambient glow, with the three progression dots pulsing beneath it. One motion
// family (the dots echo the mark itself — three nodes progressing to a tick).
// Used as the Analytics route fallback and inside BrandedReveal's fade-out
// overlay, so the loader you watch during the wait is the exact same element
// that dissolves as the content focuses in. Server-safe (no client hooks).
export function BrandedLoader() {
  return (
    <div className="brand-loader" role="status" aria-label="Loading">
      <div className="brand-loader-badge">
        <span className="brand-loader-glow" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-loader-logo" src="/brand-icon.png" alt="" aria-hidden="true" />
      </div>
      <div className="brand-loader-dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  );
}
