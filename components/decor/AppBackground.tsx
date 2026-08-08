"use client";
// AppBackground, the canonical app-wide WebGL backdrop. Ported from Elevra
// PWA (src/components/decor/AppBackground.tsx) on 2026-08-08 for the Sales
// Progressor Elevra-backgrounds pass. Adapted for Next.js: "use client",
// no other change.
//
// Mounted once per layout so the canvas persists across navigation and
// sits behind every page literally.
//
// Layering: `fixed inset-0 -z-10` so the body's --c-bg + ambient radial
// gradients (see app/styles/elevra.css) act as the natural fallback if
// WebGL fails. Shell chrome (header, sidebar) sits naturally above without
// z-index changes.
//
// Theme: both. Dark mode uses the canonical northern-lights (blue + lime
// on near-black). Light mode uses Iridescence with a white base and
// cyan/lavender-purple. Watches the <html> data-theme attribute so theme
// flips during a session do the right thing without a reload.
//
// Mobile: shader params are softened below the lg breakpoint (1024px)
// so the aurora isn't overpowering on a tall portrait viewport.
//
// iOS: swaps the WebGL Iridescence for the CSS `.iridescence-fallback-ios`
// pearlescent wash (see app/styles/elevra.css). Works around a fixed WebGL
// canvas + backdrop-filter scroll flash on iOS Safari.
import { useEffect, useState, type ReactNode } from "react";
import { SoftAurora } from "./SoftAurora";
import { Iridescence } from "./Iridescence";

const Wrap: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    {children}
  </div>
);

function useIsBelowBreakpoint(max: number): boolean {
  const [isBelow, setIsBelow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < max : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max - 1}px)`);
    const onChange = () => setIsBelow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [max]);
  return isBelow;
}

function useIsDarkTheme(): boolean {
  const read = () => {
    if (typeof document === "undefined") return false;
    const v = document.documentElement.dataset.theme;
    // Treat anything that isn't an explicit 'dark' as light. Sales
    // Progressor's historic default is light (warm cream on agent app,
    // dark photo on internal dashboard — dashboard sets data-theme="dark"
    // explicitly, so this defaults-to-light branch is fine).
    return v === "dark";
  };
  const [isDark, setIsDark] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    setIsDark(read());
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function useIsIOS(): boolean {
  const [ios] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return false;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
    // iPadOS 13+ pretends to be Mac; distinguish via touch capability.
    return navigator.userAgent.includes("Mac") && "ontouchend" in document;
  });
  return ios;
}

export function AppBackground() {
  const isMobile = useIsBelowBreakpoint(1024);
  const isDark = useIsDarkTheme();
  const isIOS = useIsIOS();

  if (isDark) {
    return (
      <Wrap>
        <div className="absolute inset-0" style={{ background: "#06060c" }} />
        <div className="absolute inset-0">
          <SoftAurora
            speed={isMobile ? 0.08 : 0.1}
            scale={isMobile ? 1.8 : 2.8}
            brightness={isMobile ? 0.28 : 0.5}
            color1="#5b8cff"
            color2="#a8ff60"
            noiseFrequency={isMobile ? 0.4 : 0.5}
            noiseAmplitude={isMobile ? 4 : 7.5}
            bandHeight={0.5}
            bandSpread={isMobile ? 0.55 : 1}
            octaveDecay={0.16}
            layerOffset={1}
            colorSpeed={0.5}
            enableMouseInteraction={false}
            mouseInfluence={0.25}
          />
        </div>
      </Wrap>
    );
  }

  if (isIOS) {
    return (
      <Wrap>
        <div className="absolute inset-0 iridescence-fallback-ios" />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <div className="absolute inset-0" style={{ background: "#ffffff" }} />
      <div className="absolute inset-0">
        <Iridescence
          speed={0.05}
          amplitude={0.3}
          mouseReact={false}
          opacity={0.18}
        />
      </div>
    </Wrap>
  );
}

export default AppBackground;
