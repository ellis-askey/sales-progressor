// Theme-swapped hero artwork for the onboarding empty states. Renders both the
// light and dark image and lets CSS show the right one under app dark mode
// (html[data-theme="dark"]) — a pure-CSS swap so there's no SSR/hydration flash.
// See the .agent-hero-art rules in globals.css.

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
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="agent-hero-art agent-hero-art-light" src={light} alt="" aria-hidden style={style} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="agent-hero-art agent-hero-art-dark" src={dark} alt="" aria-hidden style={style} />
    </>
  );
}
