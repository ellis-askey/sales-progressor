"use client";
// /dev/glass-perf — stress + fallback check for LiquidLens. Dev-only (blocks in prod).
// Renders N animated lenses over the real backdrop with a live FPS meter, plus a
// lens-vs-fallback comparison. Exposes window.__perfFps for automated measurement.

import { useEffect, useRef, useState } from "react";
import { notFound } from "next/navigation";
import { Sun, MoonStars, Sparkle, House } from "@phosphor-icons/react";
import { AppBackground } from "@/components/decor/AppBackground";
import { LiquidLens } from "@/components/liquid/LiquidLens";

type Theme = "dark" | "light";

function FpsMeter({ animate }: { animate: boolean }) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0, frames = 0, t0 = performance.now();
    const tick = (t: number) => {
      frames += 1;
      if (t - t0 >= 500) {
        const v = Math.round((frames * 1000) / (t - t0));
        setFps(v);
        (window as unknown as { __perfFps: number }).__perfFps = v;
        frames = 0; t0 = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate]);
  return <span className="pf-fps" data-low={fps > 0 && fps < 50 ? "" : undefined}>{fps} fps</span>;
}

function LensField({ count, animate }: { count: number; animate: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!animate) return;
    const wrap = wrapRef.current; if (!wrap) return;
    let raf = 0;
    const items = Array.from(wrap.querySelectorAll<HTMLElement>(".pf-puck"));
    const start = performance.now();
    const loop = (t: number) => {
      const s = (t - start) / 1000;
      items.forEach((el, i) => { el.style.transform = `translate(${Math.sin(s * 1.6 + i) * 10}px, ${Math.cos(s * 1.3 + i) * 8}px)`; });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, count]);
  return (
    <div ref={wrapRef} className="pf-field">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pf-puck">
          <LiquidLens radius={16} strength="strong" thickness={1.3} tint="rgba(255,255,255,0.1)" className="pf-puck-glass" />
        </div>
      ))}
    </div>
  );
}

export default function GlassPerf() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  const [count, setCount] = useState(20);
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
    return () => { if (prev) html.setAttribute("data-theme", prev); else html.removeAttribute("data-theme"); };
  }, [theme]);

  return (
    <div className="lg-ds pf-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppBackground />
      <div className="pf-bg" aria-hidden />
      <main className="pf-wrap">
        <header className="pf-top">
          <div>
            <div className="pf-eyebrow"><Sparkle weight="fill" /> Performance + fallback check</div>
            <h1>LiquidLens stress</h1>
          </div>
          <div className="pf-ctl">
            <FpsMeter animate={animate} />
            {[10, 20, 40, 60].map((n) => <button key={n} className={`pf-chip ${count === n ? "on" : ""}`} onClick={() => setCount(n)}>{n}</button>)}
            <button className={`pf-chip ${animate ? "on" : ""}`} onClick={() => setAnimate((a) => !a)}>{animate ? "animating" : "static"}</button>
            <button className={`pf-theme ${theme === "light" ? "on" : ""}`} aria-label="Theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              <span className="pf-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
            </button>
          </div>
        </header>

        <LensField count={count} animate={animate} />

        <section className="pf-compare">
          <div className="pf-compare-head">Lens vs fallback (same component; fallback = Safari/Firefox path, forced here)</div>
          <div className="pf-compare-row">
            <div className="pf-cc">
              <div className="pf-cc-label">Lens (Chromium/Edge)</div>
              <div className="pf-cc-scene"><span className="pf-cc-marker"><House weight="regular" /></span><p>14 Bushey Avenue</p>
                <LiquidLens radius={999} strength="strong" thickness={1.6} tint="rgba(255,255,255,0.06)" className="pf-cc-puck" />
              </div>
            </div>
            <div className="pf-cc">
              <div className="pf-cc-label">Fallback (Safari/Firefox)</div>
              <div className="pf-cc-scene"><span className="pf-cc-marker"><House weight="regular" /></span><p>14 Bushey Avenue</p>
                <LiquidLens radius={999} strength="strong" thickness={1.6} forceFallback tint="rgba(255,255,255,0.08)" className="pf-cc-puck" />
              </div>
            </div>
          </div>
        </section>

        <footer className="pf-foot">Headless software-raster is a conservative worst case; real GPU browsers composite backdrop filters far faster. Target: smooth at the per-view lens cap we adopt.</footer>
      </main>
    </div>
  );
}

const CSS = `
.pf-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background-color:var(--lg-base); }
.pf-bg{ position:absolute; inset:0; z-index:0; pointer-events:none; background:radial-gradient(60% 40% at 15% 10%, rgba(56,225,255,0.08), transparent 70%), radial-gradient(50% 35% at 85% 90%, rgba(168,255,96,0.05), transparent 70%); }
.lg-ds[data-theme="light"] .pf-bg{ background:radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.14), transparent 70%), radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.24), transparent 72%); }
.pf-wrap{ position:relative; z-index:2; max-width:1000px; margin:0 auto; padding:40px 24px 90px; }
.pf-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:20px; flex-wrap:wrap; }
.pf-eyebrow{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--lg-accent-ink); margin-bottom:8px; } .pf-eyebrow svg{ width:15px; height:15px; }
.pf-top h1{ font-size:clamp(24px,3vw,34px); font-weight:780; letter-spacing:-.03em; }
.pf-ctl{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.pf-fps{ font-size:14px; font-weight:750; color:var(--lg-ok); font-variant-numeric:tabular-nums; min-width:64px; } .pf-fps[data-low]{ color:var(--lg-warn); }
.pf-chip{ font:inherit; font-size:13px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; padding:6px 12px; cursor:pointer; }
.pf-chip.on{ background:var(--lg-accent); border-color:var(--lg-accent); color:#fff; }
.pf-theme{ width:48px; height:28px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; }
.pf-theme-knob{ position:absolute; top:2px; left:2px; width:22px; height:22px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; } .pf-theme-knob svg{ width:12px; height:12px; color:#33343c; } .pf-theme.on .pf-theme-knob{ transform:translateX(20px); }

.pf-field{ position:relative; display:grid; grid-template-columns:repeat(10,1fr); gap:14px; padding:18px; border:1px solid var(--lg-line); border-radius:18px; min-height:220px; }
@media (max-width:820px){ .pf-field{ grid-template-columns:repeat(6,1fr); } }
.pf-puck{ aspect-ratio:1; } .pf-puck-glass{ width:100%; height:100%; box-shadow:0 4px 12px rgba(0,0,0,0.26) !important; }

.pf-compare{ margin-top:22px; }
.pf-compare-head{ font-size:12px; color:var(--lg-ink-3); margin-bottom:10px; }
.pf-compare-row{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:760px){ .pf-compare-row{ grid-template-columns:1fr; } }
.pf-cc{ border:1px solid var(--lg-line-2); border-radius:16px; overflow:hidden; background:var(--lg-hover); }
.pf-cc-label{ font-size:12.5px; font-weight:700; padding:12px 16px 0; }
.pf-cc-scene{ position:relative; height:150px; margin:12px; border-radius:12px; border:1px solid var(--lg-line-2); overflow:hidden; display:flex; align-items:center; gap:10px; padding:16px; }
.pf-cc-marker{ width:40px; height:40px; border-radius:11px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); flex-shrink:0; } .pf-cc-marker svg{ width:20px; height:20px; color:var(--lg-ink-2); }
.pf-cc-scene p{ font-size:18px; font-weight:650; }
.pf-cc-puck{ position:absolute; right:40px; top:25px; width:100px; height:100px; box-shadow:0 10px 26px rgba(0,0,0,0.3) !important; }

.pf-foot{ margin-top:22px; font-size:11.5px; color:var(--lg-ink-3); line-height:1.6; }
@media (prefers-reduced-motion: reduce){ .pf-puck{ transform:none !important; } }
`;
