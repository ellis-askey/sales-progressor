// Theme-swapped hero artwork for the onboarding empty states. Renders both the
// light and dark image and lets CSS show the right one under app dark mode
// (html[data-theme="dark"]) — a pure-CSS swap so there's no SSR/hydration flash.
// See the .agent-hero-art rules in globals.css.
//
// Below 1000px the per-page illustration is swapped for a single generic
// full-cover hero background (light/dark), so every empty state falls back to
// the same calm backdrop on narrow screens where a right-masked cutout crowds
// the copy. The breakpoint + illustration-vs-generic swap is pure CSS.

// Generic full-cover fallbacks shared by every hero (shown < 1000px).
const GENERIC_LIGHT = "/hero-generic.png";
const GENERIC_DARK = "/hero-generic-dark.png";

export function HeroArt({ light, dark, maxWidth = "44%", maskStart = "42%" }: {
  light: string;
  dark: string;
  maxWidth?: string;
  maskStart?: string;
}) {
  const style: React.CSSProperties = {
    position: "absolute", right: 0, top: 0, height: "100%", width: "auto", maxWidth,
    objectFit: "cover", objectPosition: "center", pointerEvents: "none",
    WebkitMaskImage: `linear-gradient(to right, transparent, #000 ${maskStart})`,
    maskImage: `linear-gradient(to right, transparent, #000 ${maskStart})`,
  };
  // Generic fallback covers the whole card (no right-edge mask).
  const coverStyle: React.CSSProperties = {
    position: "absolute", inset: 0, width: "100%", height: "100%",
    objectFit: "cover", objectPosition: "center", pointerEvents: "none",
  };
  return (
    <>
      {/* ≥ 1000px: the per-page illustration, right-masked */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="agent-hero-art agent-hero-art-illustration agent-hero-art-light" src={light} alt="" aria-hidden style={style} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="agent-hero-art agent-hero-art-illustration agent-hero-art-dark" src={dark} alt="" aria-hidden style={style} />
      {/* < 1000px: the shared generic full-cover backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="agent-hero-art agent-hero-art-generic agent-hero-art-light" src={GENERIC_LIGHT} alt="" aria-hidden style={coverStyle} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="agent-hero-art agent-hero-art-generic agent-hero-art-dark" src={GENERIC_DARK} alt="" aria-hidden style={coverStyle} />
    </>
  );
}
