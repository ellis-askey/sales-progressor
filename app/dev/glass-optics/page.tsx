"use client";
// /dev/glass-optics — compares the current LiquidGlass engine (linear map, 3-pass
// aberration) against the experimental LiquidLens (slab optics: neutral centre +
// inward rim pull). Identical dimensions, track, colours and backdrop. Drag the
// pucks and slider handles over colourful + realistic TSP content, in both themes.
// Dev-only; nothing writes data; the current engine and /dev/updates-glass are untouched.

import { useEffect, useRef, useState, type PointerEvent as RP, type ReactNode } from "react";
import { notFound } from "next/navigation";
import * as Slider from "@radix-ui/react-slider";
import { Sun, MoonStars, Sparkle, House } from "@phosphor-icons/react";
import { AppBackground } from "@/components/decor/AppBackground";
import { LiquidGlass } from "@/components/liquid";
import { LiquidLens } from "@/components/liquid/LiquidLens";
import { createSpring, stepSpring, createFrameLoop, motionReduced } from "@/components/liquid/lib/spring";

type Theme = "dark" | "light";
type Engine = "current" | "lens";

/* A capsule slider handle in either material — identical geometry + motion. */
function Handle({ engine, drag }: { engine: Engine; drag: boolean }) {
  if (engine === "lens") {
    return <LiquidLens radius={15} strength="strong" thickness={drag ? 1.7 : 1.3} tint="rgba(255,255,255,0.12)" className="opt-cap-glass" />;
  }
  return <LiquidGlass radius={15} thickness={12} displace={drag ? 92 : 64} aberration={drag ? 11 : 7} blur={1} tint="rgba(255,255,255,0.14)" className="opt-cap-glass" />;
}

function CompareSlider({ engine }: { engine: Engine }) {
  const [val, setVal] = useState([58]);
  const [drag, setDrag] = useState(false);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const thumb = thumbRef.current, cap = capRef.current;
    if (!thumb || !cap) return;
    const spring = createSpring(0.34, 0.25, 0);
    let last = Number.NaN;
    const FULL = 700, MAX = 0.42, BASE = 0.12;
    const loop = createFrameLoop((dt) => {
      const b = thumb.getBoundingClientRect();
      const pos = b.left + b.width / 2;
      const speed = Number.isNaN(last) ? 0 : Math.abs(pos - last) / dt;
      last = pos;
      spring.target = drag && !motionReduced() ? BASE + Math.min(speed / FULL, 1) * MAX : 0;
      const moving = stepSpring(spring, dt, motionReduced());
      const along = Math.max(1 + spring.value, 0.82);
      cap.style.setProperty("--sx", along.toFixed(3));
      cap.style.setProperty("--sy", (1 / Math.sqrt(along)).toFixed(3));
      return moving || drag;
    });
    loop.start();
    return () => loop.stop();
  }, [drag]);
  useEffect(() => { const up = () => setDrag(false); window.addEventListener("pointerup", up); return () => window.removeEventListener("pointerup", up); }, []);
  return (
    <div className="opt-slider-wrap">
      <Slider.Root className="opt-slider" value={val} onValueChange={setVal} min={0} max={100} step={1} onPointerDown={() => setDrag(true)} aria-label={`${engine} slider`}>
        <Slider.Track className="opt-track"><Slider.Range className="opt-range" /></Slider.Track>
        <Slider.Thumb ref={thumbRef} className="opt-thumb">
          <div className="opt-bubble" data-show={drag || undefined} aria-hidden>{val[0]}</div>
          <div ref={capRef} className="opt-cap"><Handle engine={engine} drag={drag} /></div>
        </Slider.Thumb>
      </Slider.Root>
    </div>
  );
}

/* A draggable round puck in either material — same size, drag over the scene. */
function Puck({ engine, startX }: { engine: Engine; startX: number }) {
  const [p, setP] = useState({ x: startX, y: 0, drag: false });
  const common = {
    className: "opt-puck",
    style: { transform: `translate(${p.x}px, ${p.y}px)` } as React.CSSProperties,
    onPointerDown: (e: RP<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); setP((s) => ({ ...s, drag: true })); },
    onPointerMove: (e: RP<HTMLDivElement>) => setP((s) => (s.drag ? { ...s, x: s.x + e.movementX, y: s.y + e.movementY } : s)),
    onPointerUp: () => setP((s) => ({ ...s, drag: false })),
  };
  return engine === "lens"
    ? <LiquidLens radius={999} strength="strong" thickness={1.6} tint="rgba(255,255,255,0.06)" {...common}><span className="opt-puck-tag">Lens</span></LiquidLens>
    : <LiquidGlass radius={999} thickness={22} displace={100} aberration={9} blur={1} tint="rgba(255,255,255,0.06)" {...common}><span className="opt-puck-tag">Current</span></LiquidGlass>;
}

function SceneContent({ scene }: { scene: "colour" | "tsp" }) {
  if (scene === "colour") {
    return (
      <div className="opt-scene-colour" aria-hidden>
        <span>LIQUID</span><span>GLASS</span><span>REFRACTION</span><span>ABERRATION</span>
        <div className="opt-blob a" /><div className="opt-blob b" /><div className="opt-blob c" />
      </div>
    );
  }
  return (
    <div className="opt-scene-tsp" aria-hidden>
      <div className="opt-tsp-head"><span className="opt-marker"><House weight="regular" /></span><div><strong>14 Bushey Avenue</strong><em>Broxbourne, EN10 6QE</em></div></div>
      <p className="opt-tsp-body">You confirmed all enquiries have been raised with the seller&apos;s solicitor. Searches are back with no adverse entries, and the mortgage offer is in.</p>
      <div className="opt-tsp-prog"><span style={{ width: "62%" }} /></div>
      <div className="opt-tsp-rows">
        <div className="opt-tsp-row"><span /><p>A solicitor replied to our chase</p></div>
        <div className="opt-tsp-row"><span /><p>Priya Shah uploaded Local-Authority-Search.pdf</p></div>
      </div>
    </div>
  );
}

export default function GlassOptics() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  const [scene, setScene] = useState<"colour" | "tsp">("colour");
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
    return () => { if (prev) html.setAttribute("data-theme", prev); else html.removeAttribute("data-theme"); };
  }, [theme]);

  return (
    <div className="lg-ds opt-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppBackground />
      <div className="opt-bg" aria-hidden />

      <main className="opt-wrap">
        <header className="opt-top">
          <div>
            <div className="opt-eyebrow"><Sparkle weight="fill" /> Optics comparison</div>
            <h1>Glass material: current vs slab lens</h1>
            <p>Same geometry, track, coral accent, motion and backdrop. The slab lens (right) has a crisp centre and a cleanly magnifying rim; the current engine (left) shows the coral streaks. Drag everything; switch scene + theme.</p>
          </div>
          <button className={`opt-theme ${theme === "light" ? "on" : ""}`} aria-label="Toggle theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="opt-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
          </button>
        </header>

        <div className="opt-scene-switch">
          {(["colour", "tsp"] as const).map((s) => (
            <button key={s} className={`opt-chip ${scene === s ? "on" : ""}`} onClick={() => setScene(s)}>{s === "colour" ? "Colourful" : "TSP content"}</button>
          ))}
        </div>

        <section className="opt-stage">
          <SceneContent scene={scene} />
          <Puck engine="current" startX={-120} />
          <Puck engine="lens" startX={80} />
          <div className="opt-legend"><span>← drag both pucks over the content →</span></div>
        </section>

        <div className="opt-sliders">
          <div className="opt-slider-card">
            <div className="opt-slider-label">Current engine</div>
            <div className="opt-slider-scene"><SceneContent scene={scene} /><CompareSlider engine="current" /></div>
          </div>
          <div className="opt-slider-card">
            <div className="opt-slider-label">Slab lens <span className="opt-exp">experimental</span></div>
            <div className="opt-slider-scene"><SceneContent scene={scene} /><CompareSlider engine="lens" /></div>
          </div>
        </div>

        <footer className="opt-foot">
          Experimental variant alongside the current engine. Capable browsers (Chromium/Edge) get the full displacement lens;
          Safari/Firefox fall back to frosted blur. Reduced-motion honoured. Map cached by size. Attribution in
          <code>components/liquid/lib/refraction-map.ts</code>.
        </footer>
      </main>
    </div>
  );
}

const CSS = `
.opt-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background-color:var(--lg-base); }
.opt-bg{ position:absolute; inset:0; z-index:0; pointer-events:none; background:radial-gradient(60% 40% at 15% 10%, rgba(56,225,255,0.07), transparent 70%), radial-gradient(50% 35% at 85% 90%, rgba(168,255,96,0.05), transparent 70%); }
.lg-ds[data-theme="light"] .opt-bg{ background:radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.14), transparent 70%), radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.24), transparent 72%); }
.opt-wrap{ position:relative; z-index:2; max-width:1000px; margin:0 auto; padding:48px 24px 110px; }
.opt-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:22px; }
.opt-eyebrow{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--lg-accent-ink); margin-bottom:9px; } .opt-eyebrow svg{ width:15px; height:15px; }
.opt-top h1{ font-size:clamp(26px,3.4vw,38px); font-weight:780; letter-spacing:-.03em; line-height:1.05; }
.opt-top p{ font-size:14.5px; color:var(--lg-ink-2); margin-top:9px; max-width:640px; line-height:1.5; }
.opt-theme{ width:52px; height:31px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; flex-shrink:0; }
.opt-theme.on{ background:var(--lg-accent-soft); }
.opt-theme-knob{ position:absolute; top:2px; left:2px; width:25px; height:25px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.3); transition:transform .4s var(--lg-spring); } .opt-theme-knob svg{ width:13px; height:13px; color:#33343c; }
.opt-theme.on .opt-theme-knob{ transform:translateX(21px); }

.opt-scene-switch{ display:flex; gap:8px; margin-bottom:16px; }
.opt-chip{ font:inherit; font-size:13px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:10px; padding:7px 14px; cursor:pointer; }
.opt-chip.on{ background:var(--lg-accent); border-color:var(--lg-accent); color:#fff; }

/* stage with draggable pucks */
.opt-stage{ position:relative; height:300px; border-radius:20px; overflow:hidden; border:1px solid var(--lg-line); margin-bottom:18px; }
.opt-puck{ position:absolute; z-index:3; top:95px; left:50%; width:120px; height:120px; cursor:grab; touch-action:none; display:grid; place-items:center; box-shadow:0 14px 34px rgba(0,0,0,0.3) !important; }
.opt-puck:active{ cursor:grabbing; }
.opt-puck-tag{ position:relative; z-index:1; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:rgba(255,255,255,0.9); text-shadow:0 1px 3px rgba(0,0,0,0.45); pointer-events:none; }
.opt-legend{ position:absolute; z-index:1; bottom:12px; left:0; right:0; text-align:center; font-size:11px; color:var(--lg-ink-3); }

/* colourful scene */
.opt-scene-colour{ position:absolute; inset:0; display:grid; grid-template-columns:1fr 1fr; align-content:center; gap:4px; padding:26px; }
.opt-scene-colour span{ font-size:40px; font-weight:800; letter-spacing:-.02em; color:rgba(255,255,255,0.12); }
.opt-blob{ position:absolute; border-radius:50%; filter:blur(14px); } .opt-blob.a{ width:180px; height:180px; left:6%; top:-30px; background:#5e5ce6; } .opt-blob.b{ width:200px; height:200px; right:2%; bottom:-50px; background:#30c8a0; } .opt-blob.c{ width:130px; height:130px; right:34%; top:-20px; background:#ff9f0a; }

/* tsp scene */
.opt-scene-tsp{ position:absolute; inset:0; padding:22px 26px; }
.opt-tsp-head{ display:flex; align-items:center; gap:12px; } .opt-marker{ width:38px; height:38px; border-radius:11px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); } .opt-marker svg{ width:19px; height:19px; color:var(--lg-ink-2); }
.opt-tsp-head strong{ display:block; font-size:16px; font-weight:650; } .opt-tsp-head em{ font-style:normal; font-size:12.5px; color:var(--lg-ink-3); }
.opt-tsp-body{ font-size:14px; line-height:1.55; color:var(--lg-ink-2); margin:14px 0; max-width:560px; }
.opt-tsp-prog{ height:5px; border-radius:999px; background:var(--lg-fill); overflow:hidden; max-width:420px; } .opt-tsp-prog > span{ display:block; height:100%; background:var(--lg-accent); border-radius:999px; }
.opt-tsp-rows{ margin-top:16px; display:flex; flex-direction:column; gap:12px; } .opt-tsp-row{ display:flex; align-items:center; gap:10px; } .opt-tsp-row span{ width:24px; height:24px; border-radius:50%; background:var(--lg-fill); flex-shrink:0; } .opt-tsp-row p{ font-size:13.5px; color:var(--lg-ink); }

/* sliders */
.opt-sliders{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:820px){ .opt-sliders{ grid-template-columns:1fr; } }
.opt-slider-card{ border:1px solid var(--lg-line-2); border-radius:18px; background:var(--lg-hover); overflow:hidden; }
.opt-slider-label{ font-size:13px; font-weight:700; padding:14px 18px 0; display:flex; align-items:center; gap:8px; } .opt-exp{ font-size:10px; font-weight:650; color:var(--lg-accent-ink); background:var(--lg-accent-soft); padding:2px 7px; border-radius:999px; text-transform:none; }
.opt-slider-scene{ position:relative; height:150px; margin:14px; border-radius:14px; overflow:hidden; border:1px solid var(--lg-line-2); }
.opt-slider-scene .opt-scene-colour span{ font-size:26px; } .opt-slider-scene .opt-scene-tsp{ padding:14px 16px; } .opt-slider-scene .opt-tsp-body{ font-size:12px; margin:8px 0; } .opt-slider-scene .opt-tsp-rows{ display:none; }
.opt-slider-wrap{ position:absolute; z-index:3; left:16px; right:16px; bottom:22px; }
.opt-slider{ position:relative; display:flex; align-items:center; width:100%; height:34px; touch-action:none; user-select:none; }
.opt-track{ position:relative; flex:1; height:6px; border-radius:999px; background:rgba(255,255,255,0.22); }
.opt-range{ position:absolute; height:100%; border-radius:999px; background:var(--lg-accent); }
.opt-thumb{ position:relative; display:block; width:48px; height:30px; outline:none; }
.opt-cap{ width:48px; height:30px; transform:scaleX(var(--sx,1)) scaleY(var(--sy,1)); transform-origin:center; will-change:transform; }
.opt-cap-glass{ width:48px; height:30px; box-shadow:0 3px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.55) !important; }
.opt-thumb:focus-visible .opt-cap-glass{ box-shadow:0 0 0 3px var(--lg-accent-soft), 0 0 0 1.5px var(--lg-accent) !important; }
.opt-bubble{ position:absolute; bottom:calc(100% + 12px); left:50%; min-width:34px; padding:5px 9px; border-radius:11px; text-align:center; font-size:14px; font-weight:750; color:var(--lg-ink); background:var(--lg-glass-raised); border:1px solid var(--lg-line); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); box-shadow:0 6px 16px rgba(0,0,0,0.26); opacity:0; transform:translateX(-50%) translateY(8px) scale(0.9); transition:opacity .25s var(--lg-ease), transform .3s var(--lg-spring); pointer-events:none; }
.opt-bubble[data-show]{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); }

.opt-foot{ margin-top:26px; font-size:11.5px; color:var(--lg-ink-3); line-height:1.6; } .opt-foot code{ font-family:ui-monospace,monospace; background:var(--lg-fill); padding:1px 6px; border-radius:6px; }

@media (prefers-reduced-motion: reduce){ .opt-root *{ animation:none !important; } }
`;
