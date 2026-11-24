"use client";

// The phone stage: a realistic portal viewport with switchable backgrounds, real
// scrolling content, the chosen top + bottom nav overlaid, and the hide/reveal
// engine applied to the bottom dock so glass can be judged over real content.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSettings, type HideMode, type TabKey } from "./kit";
import type { TopVariant } from "./top";
import type { BottomVariant } from "./bottom";

function hideStyle(mode: HideMode, scroll: number, down: boolean): CSSProperties {
  const k = Math.min(1, scroll);
  switch (mode) {
    case "hideDown": return down ? { transform: "translateY(150%)", opacity: 0 } : {};
    case "slideUnder": return down ? { transform: "translateY(118%)" } : {};
    case "shrink": return { transform: `scale(${1 - k * 0.28})`, opacity: 1 - k * 0.3, transformOrigin: "bottom center" };
    case "fade": return { opacity: 1 - k * 0.75 };
    case "handle": return down ? { transform: "translateY(66%)", opacity: 0.9 } : {};
    case "iconsOnly": return { transform: `scale(${down ? 0.84 : 1})` };
    default: return {};
  }
}

function PortalContent() {
  return (
    <>
      <div className="pnl-hero">
        <div className="pnl-hero-art" />
        <div className="pnl-hero-copy">
          <p className="pnl-hero-sub">Your purchase</p>
          <h1 className="pnl-hero-addr">14 Oakfield Road</h1>
          <p className="pnl-hero-town">Bristol, BS6 7PL</p>
        </div>
      </div>
      <div className="pnl-body">
        <section className="pnl-c">
          <div className="pnl-c-head"><span>Your progress</span><span className="pnl-c-pct">62%</span></div>
          <div className="pnl-c-prog"><span style={{ width: "62%" }} /></div>
          <p className="pnl-c-note">Enquiries are with the seller&rsquo;s solicitor. Exchange expected in about 3 weeks.</p>
        </section>
        <section className="pnl-c">
          <p className="pnl-c-kick">Latest update</p>
          <p className="pnl-c-title">Searches are back</p>
          <p className="pnl-c-note">Your solicitor has the local authority searches and is reviewing them now.</p>
          <p className="pnl-c-meta">Yesterday, from your progression team</p>
        </section>
        <section className="pnl-c">
          <p className="pnl-c-kick">What&rsquo;s next</p>
          <p className="pnl-c-title">Sign your contract</p>
          <p className="pnl-c-note">Once enquiries settle, your solicitor sends the contract to sign.</p>
        </section>
        <section className="pnl-c">
          <p className="pnl-c-kick">Your team</p>
          <p className="pnl-c-note">Priya is progressing your purchase. Message her any time from the menu.</p>
        </section>
        <section className="pnl-c pnl-c--ghost"><p className="pnl-c-note">Keep scrolling to feel the dock hide and return.</p></section>
        <div style={{ height: 150 }} />
      </div>
    </>
  );
}

export function Phone({
  top,
  bottom,
  active,
  setActive,
}: {
  top: TopVariant;
  bottom: BottomVariant;
  active: TabKey;
  setActive: (k: TabKey) => void;
}) {
  const s = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [down, setDown] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    last.current = el.scrollTop;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = el!.scrollTop;
        setScroll(Math.min(1, y / 360));
        const dy = y - last.current;
        if (y < 44) setDown(false);
        else if (dy > 6) setDown(true);
        else if (dy < -6) setDown(false);
        last.current = y;
        ticking = false;
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pnl-phone" data-theme={s.theme} data-bg={s.bg}>
      <div className="pnl-notch" />
      <div className="pnl-screen" ref={ref}>
        <PortalContent />
      </div>
      <div className="pnl-top-layer" style={{ "--pnl-gap": `${s.edgeGap}px` } as CSSProperties}>
        <div className="pnl-scaler" style={{ transform: `scale(${s.size})` }}>{top.render({ scroll })}</div>
      </div>
      <div className="pnl-bottom-layer" style={{ ...hideStyle(s.hideMode, scroll, down), "--pnl-gap": `${s.edgeGap}px` } as CSSProperties}>
        <div className="pnl-scaler" style={{ transform: `scale(${s.size})` }}>{bottom.render({ active, setActive, down, scroll, mini: false })}</div>
      </div>
    </div>
  );
}
