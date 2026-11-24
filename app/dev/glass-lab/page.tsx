"use client";
// /dev/glass-lab — interaction laboratory. Dev-only (blocks in production).
//
// Interaction + accessibility from Radix; glass MATERIAL from our LiquidGlass
// engine; MOTION from spring physics adapted from Glassy UI (MIT) — see
// components/liquid/lib/spring.ts. Accent is the TSP coral token. Nothing here
// writes data or touches production.
//
// Attribution: slider knob-stretch and dock lens motion are adapted from Glassy UI
// (https://github.com/alexburlis/glassyui, MIT) — technique reused, restyled on our
// stack (no Tailwind 4 / shadcn install).

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Dialog from "@radix-ui/react-dialog";
import { Sun, MoonStars, Sparkle, House, MagnifyingGlass, ChatCircle, Bell, Gear, X, Check } from "@phosphor-icons/react";
import { AppBackground } from "@/components/decor/AppBackground";
import { LiquidGlass } from "@/components/liquid";
import { createSpring, stepSpring, createFrameLoop, motionReduced } from "@/components/liquid/lib/spring";

type Theme = "dark" | "light";

function Demo({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  return (
    <section className="lab-demo">
      <div className="lab-demo-head"><h3>{title}</h3><span className="lab-src">{source}</span></div>
      <div className="lab-stage">{children}</div>
    </section>
  );
}

/* ── 1 · Slider: wide refracting capsule, drag-stretch, spring settle, value bubble ── */
function LabSlider() {
  const [val, setVal] = useState([58]);
  const [drag, setDrag] = useState(false);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thumb = thumbRef.current, cap = capRef.current;
    if (!thumb || !cap) return;
    // response 0.34s, bounce 0.22 → small, noticeable overshoot on settle.
    const spring = createSpring(0.34, 0.25, 0);
    let last = Number.NaN;
    // BASE: a persistent grab-elongation while dragging (the handle reads fluid
    // even at low speed); velocity adds up to +MAX more on a quick flick.
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

  useEffect(() => {
    const up = () => setDrag(false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  return (
    <div className="lab-slider-wrap">
      <Slider.Root className="lab2-slider" value={val} onValueChange={setVal} min={0} max={100} step={1}
        onPointerDown={() => setDrag(true)} aria-label="Material slider">
        <Slider.Track className="lab2-track"><Slider.Range className="lab2-range" /></Slider.Track>
        <Slider.Thumb ref={thumbRef} className="lab2-thumb">
          <div className="lab2-bubble" data-show={drag || undefined} aria-hidden>{val[0]}</div>
          <div ref={capRef} className="lab2-cap">
            <LiquidGlass radius={15} thickness={12} displace={drag ? 92 : 64} aberration={drag ? 11 : 7} blur={1}
              tint="rgba(255,255,255,0.14)" className="lab2-cap-glass" />
          </div>
        </Slider.Thumb>
      </Slider.Root>
      <span className="lab-val">{val[0]}</span>
    </div>
  );
}

/* ── 2 · Switch (glass knob swells on press) ───────────────────────────────── */
function LabSwitch() {
  const [on, setOn] = useState(true);
  const [press, setPress] = useState(false);
  return (
    <div className="lab-switch-row">
      <Switch.Root className="lab-switch" checked={on} onCheckedChange={setOn} aria-label="Glass switch"
        onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
        onBlur={() => setPress(false)}>
        <Switch.Thumb className="lab-switch-thumb" data-press={press || undefined}>
          <LiquidGlass radius={999} thickness={8} displace={press ? 72 : 42} aberration={press ? 10 : 4} blur={1}
            tint="rgba(255,255,255,0.2)" className="lab-switch-glass" />
        </Switch.Thumb>
      </Switch.Root>
      <span className="lab-val">{on ? "On" : "Off"}</span>
    </div>
  );
}

/* ── 3 · Segmented control, spring indicator + draggable selection ─────────── */
const SEG = [{ v: "day", l: "Day" }, { v: "week", l: "Week" }, { v: "month", l: "Month" }, { v: "quarter", l: "Quarter" }];
function LabSegmented() {
  const [val, setVal] = useState("week");
  const rootRef = useRef<HTMLDivElement>(null);
  const items = useRef<Record<string, HTMLButtonElement | null>>({});
  const indRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const springRef = useRef(createSpring(0.32, 0.2, 0));
  const loopRef = useRef<ReturnType<typeof createFrameLoop> | null>(null);
  const dragging = useRef(false);

  const targetFor = (v: string) => {
    const root = rootRef.current, el = items.current[v];
    if (!root || !el) return null;
    return el.getBoundingClientRect().left - root.getBoundingClientRect().left;
  };

  useLayoutEffect(() => {
    const el = items.current[val];
    if (el) setW(el.offsetWidth);
    const t = targetFor(val);
    if (t != null) { springRef.current.value = t; springRef.current.target = t; if (indRef.current) indRef.current.style.transform = `translateX(${t}px)`; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateTo = (v: string) => {
    const t = targetFor(v);
    if (t == null) return;
    springRef.current.target = t;
    if (loopRef.current) return;
    loopRef.current = createFrameLoop((dt) => {
      const moving = stepSpring(springRef.current, dt, motionReduced());
      if (indRef.current) indRef.current.style.transform = `translateX(${springRef.current.value}px)`;
      if (!moving) { loopRef.current?.stop(); loopRef.current = null; }
      return moving;
    });
    loopRef.current.start();
  };
  const select = (v: string) => { if (v !== val) { setVal(v); animateTo(v); } };
  const pointTo = (clientX: number) => {
    for (const o of SEG) { const el = items.current[o.v]; if (!el) continue; const b = el.getBoundingClientRect(); if (clientX >= b.left && clientX <= b.right) { select(o.v); return; } }
  };

  return (
    <RadioGroup.Root ref={rootRef} className="lab-seg" value={val} onValueChange={select} orientation="horizontal" aria-label="Range"
      onPointerDown={(e) => { dragging.current = true; pointTo(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) pointTo(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }} onPointerLeave={() => { dragging.current = false; }}>
      <div ref={indRef} className="lab-seg-ind" style={{ width: w }}>
        <LiquidGlass radius={10} thickness={8} displace={40} aberration={3} blur={1} tint="rgba(255,255,255,0.18)" className="lab-seg-glass" />
      </div>
      {SEG.map((o) => (
        <RadioGroup.Item key={o.v} value={o.v} ref={(el) => { items.current[o.v] = el; }} className="lab-seg-item" data-on={val === o.v}>{o.l}</RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/* ── 4 · Floating dock: a moving glass lens, spring-driven, raised & overlapping ── */
const DOCK = [{ Icon: House, label: "Home" }, { Icon: MagnifyingGlass, label: "Search" }, { Icon: ChatCircle, label: "Messages" }, { Icon: Bell, label: "Alerts" }, { Icon: Gear, label: "Settings" }];
function LabDock() {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [press, setPress] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lensRef = useRef<HTMLDivElement>(null);
  // bounce 0.28 → a small but noticeable overshoot as the lens settles.
  const springRef = useRef(createSpring(0.34, 0.28, 0));
  const loopRef = useRef<ReturnType<typeof createFrameLoop> | null>(null);
  const target = hover ?? active;

  const centerOf = (i: number) => {
    const dock = dockRef.current, el = itemRefs.current[i];
    if (!dock || !el) return null;
    const d = dock.getBoundingClientRect(), b = el.getBoundingClientRect();
    return b.left - d.left + b.width / 2;
  };

  useLayoutEffect(() => {
    const c = centerOf(active);
    if (c != null) { springRef.current.value = c; springRef.current.target = c; if (lensRef.current) lensRef.current.style.setProperty("--x", String(c)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = centerOf(target);
    if (c == null) return;
    springRef.current.target = c;
    if (loopRef.current) return;
    loopRef.current = createFrameLoop((dt) => {
      const moving = stepSpring(springRef.current, dt, motionReduced());
      if (lensRef.current) lensRef.current.style.setProperty("--x", springRef.current.value.toFixed(2));
      if (!moving) { loopRef.current?.stop(); loopRef.current = null; }
      return moving;
    });
    loopRef.current.start();
  }, [target]);

  return (
    <div ref={dockRef} className="lab-dock2" onPointerLeave={() => { setHover(null); setPress(false); }}>
      <LiquidGlass radius={24} thickness={14} displace={44} aberration={3} tint="var(--lg-glass-raised)" className="lab-dock2-shelf" aria-hidden />
      <div ref={lensRef} className="lab-dock2-lens" data-press={press || undefined} aria-hidden>
        <LiquidGlass radius={17} thickness={13} displace={78} aberration={8} blur={1} tint="rgba(255,255,255,0.1)" className="lab-dock2-lens-glass" />
      </div>
      <div className="lab-dock2-items">
        {DOCK.map(({ Icon, label }, i) => (
          <button key={i} ref={(el) => { itemRefs.current[i] = el; }} className="lab-dock2-item" data-active={active === i || undefined}
            aria-label={label} aria-current={active === i ? "page" : undefined}
            onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)}
            onClick={() => setActive(i)}>
            <Icon weight="fill" />
            <span className="lab-dock2-label">{label}</span>
            <span className="lab-dock2-dot" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── 5 · Modal + drawer (Radix Dialog) ─────────────────────────────────────── */
function LabModal() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild><button className="lgbtn lgbtn--primary">Open modal</button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="lab-overlay" />
        <Dialog.Content className="lab-modal-pos" aria-describedby={undefined}>
          <LiquidGlass radius={22} thickness={16} displace={40} aberration={3} tint="var(--lg-glass-raised)" className="lab-modal">
            <Dialog.Title className="lab-modal-title">Move to exchange?</Dialog.Title>
            <p className="lab-modal-body">Escape, backdrop click and the close button all dismiss this, and focus returns to the trigger.</p>
            <div className="lab-modal-actions">
              <Dialog.Close asChild><button className="lgbtn lgbtn--primary">Confirm <Check weight="bold" /></button></Dialog.Close>
              <Dialog.Close asChild><button className="lgbtn lgbtn--ghost">Cancel</button></Dialog.Close>
            </div>
            <Dialog.Close asChild><button className="lab-modal-x" aria-label="Close"><X weight="bold" /></button></Dialog.Close>
          </LiquidGlass>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function LabDrawer() {
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const dragging = useRef<{ x: number } | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDx(0); }}>
      <Dialog.Trigger asChild><button className="lgbtn lgbtn--secondary">Open drawer</button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="lab-overlay" />
        <Dialog.Content className="lab-drawer-pos" aria-describedby={undefined} style={{ transform: dx ? `translateX(${dx}px)` : undefined }}>
          <LiquidGlass radius={0} thickness={18} displace={44} aberration={3} tint="var(--lg-glass-raised)" className="lab-drawer">
            <span className="lab-drawer-grip"
              onPointerDown={(e) => { dragging.current = { x: e.clientX }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => { if (dragging.current) setDx(Math.max(0, e.clientX - dragging.current.x)); }}
              onPointerUp={() => { if (dx > 120) setOpen(false); else setDx(0); dragging.current = null; }} />
            <Dialog.Title className="lab-modal-title">Filters</Dialog.Title>
            <p className="lab-modal-body">Slides in from the edge with open and close animations. Drag the grip right to dismiss. Escape and focus trapping work too.</p>
            <Dialog.Close asChild><button className="lgbtn lgbtn--ghost lgbtn--full">Close</button></Dialog.Close>
          </LiquidGlass>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── 6 · Pure refraction surface (draggable lens) ──────────────────────────── */
function LabRefraction() {
  const [p, setP] = useState({ x: 0, y: 0, drag: false });
  return (
    <div className="lab-refract-stage">
      <div className="lab-refract-content">
        <span>LIQUID</span><span>GLASS</span><span>REFRACTION</span><span>ABERRATION</span>
        <div className="lab-blob a" /><div className="lab-blob b" /><div className="lab-blob c" />
      </div>
      <LiquidGlass radius={999} thickness={26} displace={110} aberration={10} blur={1} tint="rgba(255,255,255,0.05)"
        className="lab-lens" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setP((s) => ({ ...s, drag: true })); }}
        onPointerMove={(e) => setP((s) => (s.drag ? { ...s, x: s.x + e.movementX, y: s.y + e.movementY } : s))}
        onPointerUp={() => setP((s) => ({ ...s, drag: false }))}>
        <span className="lab-lens-hint">drag</span>
      </LiquidGlass>
    </div>
  );
}

export default function GlassLab() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
    return () => { if (prev) html.setAttribute("data-theme", prev); else html.removeAttribute("data-theme"); };
  }, [theme]);

  return (
    <div className="lg-ds lab-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppBackground />
      <div className="lab-scene" aria-hidden />

      <main className="lab-wrap">
        <header className="lab-top">
          <div>
            <div className="lab-eyebrow"><Sparkle weight="fill" /> Interaction laboratory</div>
            <h1>Glass controls</h1>
            <p>Radix interaction + LiquidGlass material + adapted Glassy UI spring physics, in the TSP coral accent. Drag, toggle, use the keyboard, switch themes.</p>
          </div>
          <button className={`lab-theme ${theme === "light" ? "on" : ""}`} aria-label="Toggle theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="lab-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
          </button>
        </header>

        <div className="lab-grid">
          <Demo title="1 · Material slider" source="Radix Slider · refracting capsule, drag-stretch + settle"><LabSlider /></Demo>
          <Demo title="4 · Floating dock" source="Moving glass lens · spring glide, raised & overlapping"><div className="lab-dock-wrap"><LabDock /></div></Demo>
          <Demo title="2 · Glass switch" source="Radix Switch · adapted knob-swell"><LabSwitch /></Demo>
          <Demo title="3 · Segmented control" source="Radix RadioGroup · spring indicator + drag select"><LabSegmented /></Demo>
          <Demo title="5 · Modal & drawer" source="Radix Dialog · focus trap, escape, scroll-lock"><div className="lab-row"><LabModal /><LabDrawer /></div></Demo>
          <Demo title="6 · Pure refraction" source="LiquidGlass engine · no hover spotlight"><LabRefraction /></Demo>
        </div>

        <footer className="lab-foot">
          Experimental. Nothing here is approved or writes data. Slider and dock refined per review (capsule handle, moving lens,
          coral accent). Attribution in <code>components/liquid/lib/spring.ts</code>.
        </footer>
      </main>
    </div>
  );
}

const CSS = `
.lab-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background-color:var(--lg-base); }
.lab-scene{ position:absolute; inset:0; z-index:0; pointer-events:none; background:radial-gradient(60% 40% at 15% 10%, rgba(56,225,255,0.08), transparent 70%), radial-gradient(50% 35% at 85% 90%, rgba(168,255,96,0.05), transparent 70%); }
.lg-ds[data-theme="light"] .lab-scene{ background:radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%), radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%), radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%); }
.lab-wrap{ position:relative; z-index:2; max-width:1000px; margin:0 auto; padding:52px 24px 120px; }
.lab-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:28px; }
.lab-eyebrow{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--lg-accent-ink); margin-bottom:9px; } .lab-eyebrow svg{ width:15px; height:15px; }
.lab-top h1{ font-size:clamp(30px,4vw,42px); font-weight:780; letter-spacing:-.035em; line-height:1; }
.lab-top p{ font-size:15px; color:var(--lg-ink-2); margin-top:9px; max-width:600px; }
.lab-theme{ width:52px; height:31px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; flex-shrink:0; }
.lab-theme.on{ background:var(--lg-accent-soft); }
.lab-theme-knob{ position:absolute; top:2px; left:2px; width:25px; height:25px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.3); transition:transform .4s var(--lg-spring); } .lab-theme-knob svg{ width:13px; height:13px; color:#33343c; }
.lab-theme.on .lab-theme-knob{ transform:translateX(21px); }

.lab-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:760px){ .lab-grid{ grid-template-columns:1fr; } }
.lab-demo{ border:1px solid var(--lg-line-2); border-radius:18px; background:var(--lg-hover); overflow:hidden; }
.lab-demo-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:14px 18px 0; }
.lab-demo-head h3{ font-size:15px; font-weight:700; } .lab-src{ font-size:10.5px; color:var(--lg-ink-3); text-align:right; }
.lab-stage{ padding:34px 18px 38px; display:grid; place-items:center; min-height:160px; }
.lab-row{ display:flex; gap:12px; flex-wrap:wrap; justify-content:center; }
.lab-val{ font-size:13px; font-weight:650; color:var(--lg-ink-2); min-width:40px; font-variant-numeric:tabular-nums; }

/* 1 · slider (capsule) */
.lab-slider-wrap{ display:flex; align-items:center; gap:18px; width:100%; max-width:330px; }
.lab2-slider{ position:relative; display:flex; align-items:center; width:100%; height:34px; touch-action:none; user-select:none; }
.lab2-track{ position:relative; flex:1; height:6px; border-radius:999px; background:var(--lg-fill); }
.lab2-range{ position:absolute; height:100%; border-radius:999px; background:var(--lg-accent); }
.lab2-thumb{ position:relative; display:block; width:48px; height:30px; outline:none; }
.lab2-cap{ width:48px; height:30px; transform:scaleX(var(--sx,1)) scaleY(var(--sy,1)); transform-origin:center; will-change:transform; }
.lab2-cap-glass{ width:48px; height:30px; box-shadow:0 3px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.55) !important; }
.lab2-thumb:focus-visible .lab2-cap-glass{ box-shadow:0 0 0 3px var(--lg-accent-soft), 0 0 0 1.5px var(--lg-accent), 0 3px 10px rgba(0,0,0,0.3) !important; }
.lab2-bubble{ position:absolute; bottom:calc(100% + 12px); left:50%; min-width:34px; padding:5px 9px; border-radius:11px; text-align:center;
  font-size:14px; font-weight:750; color:var(--lg-ink); background:var(--lg-glass-raised); border:1px solid var(--lg-line);
  -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); box-shadow:0 6px 16px rgba(0,0,0,0.26);
  opacity:0; transform:translateX(-50%) translateY(8px) scale(0.9); transition:opacity .25s var(--lg-ease), transform .3s var(--lg-spring); pointer-events:none; }
.lab2-bubble[data-show]{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
.lab2-bubble::after{ content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:var(--lg-glass-raised); }

/* 2 · switch */
.lab-switch-row{ display:flex; align-items:center; gap:14px; }
.lab-switch{ width:60px; height:34px; border-radius:999px; border:1px solid var(--lg-line); background:rgba(120,120,128,0.4); position:relative; padding:0; cursor:pointer; transition:background .4s; }
.lab-switch[data-state="checked"]{ background:var(--lg-ok); }
.lab-switch-thumb{ --x:0px; --s:1; position:absolute; top:3px; left:3px; width:28px; height:28px; display:block; transform:translateX(var(--x)) scale(var(--s)); transition:transform .42s var(--lg-spring); }
.lab-switch[data-state="checked"] .lab-switch-thumb{ --x:26px; }
.lab-switch-thumb[data-press]{ --s:1.16; }
.lab-switch:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.lab-switch-glass{ width:28px; height:28px; box-shadow:0 2px 6px rgba(0,0,0,0.3) !important; }

/* 3 · segmented */
.lab-seg{ position:relative; display:inline-grid; grid-auto-flow:column; grid-auto-columns:1fr; padding:4px; border-radius:14px; background:rgba(0,0,0,0.22); border:1px solid var(--lg-line); touch-action:none; }
.lg-ds[data-theme="light"] .lab-seg{ background:rgba(12,16,28,0.05); }
.lab-seg-ind{ position:absolute; top:4px; bottom:4px; left:4px; pointer-events:none; }
.lab-seg-glass{ width:100%; height:100%; }
.lab-seg-item{ position:relative; z-index:1; padding:9px 18px; font:inherit; font-size:13px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; cursor:pointer; transition:color .3s; white-space:nowrap; border-radius:10px; }
.lab-seg-item[data-on="true"]{ color:var(--lg-ink); }
.lab-seg-item:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

/* 4 · dock (moving lens) */
.lab-dock-wrap{ padding:26px 0 10px; }
.lab-dock2{ position:relative; display:inline-block; }
.lab-dock2-shelf{ position:absolute; inset:0; z-index:0; }
.lab-dock2-items{ position:relative; z-index:2; display:flex; align-items:center; gap:10px; padding:12px 16px; }
.lab-dock2-item{ position:relative; width:46px; height:46px; border-radius:14px; display:grid; place-items:center; border:none; background:none; cursor:pointer; color:var(--lg-ink); }
.lab-dock2-item svg{ width:23px; height:23px; }
.lab-dock2-item:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:3px; border-radius:14px; }
.lab-dock2-label{ position:absolute; bottom:calc(100% + 12px); left:50%; transform:translateX(-50%) translateY(4px); white-space:nowrap; font-size:11.5px; font-weight:600; padding:5px 10px; border-radius:9px; background:var(--lg-glass-raised); border:1px solid var(--lg-line); color:var(--lg-ink); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); opacity:0; pointer-events:none; transition:opacity .2s, transform .2s var(--lg-spring); box-shadow:0 5px 14px rgba(0,0,0,0.22); }
.lab-dock2-item:hover .lab-dock2-label, .lab-dock2-item:focus-visible .lab-dock2-label{ opacity:1; transform:translateX(-50%) translateY(0); }
.lab-dock2-dot{ position:absolute; bottom:4px; left:50%; transform:translateX(-50%); width:4px; height:4px; border-radius:50%; background:transparent; transition:background .3s; }
.lab-dock2-item[data-active] .lab-dock2-dot{ background:var(--lg-accent); }
/* the lens: raised above the shelf, overlapping, spring-driven */
.lab-dock2-lens{ position:absolute; top:50%; left:0; z-index:1; width:56px; height:56px; pointer-events:none;
  transform:translate(calc(var(--x,0) * 1px - 50%), -50%); }
.lab-dock2-lens-glass{ width:56px; height:56px; box-shadow:0 8px 20px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.5) !important; transition:transform .14s var(--lg-ease); }
.lab-dock2-lens[data-press] .lab-dock2-lens-glass{ transform:scale(0.9); }

/* 5 · overlays */
.lab-overlay{ position:fixed; inset:0; z-index:60; background:rgba(0,0,0,0.42); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); }
.lab-overlay[data-state="open"]{ animation:lab-fade .3s ease; }
.lab-overlay[data-state="closed"]{ animation:lab-fade .2s ease reverse; }
@keyframes lab-fade{ from{opacity:0} to{opacity:1} }
.lab-modal-pos{ position:fixed; z-index:61; top:50%; left:50%; transform:translate(-50%,-50%); width:min(430px,calc(100vw - 40px)); outline:none; }
.lab-modal-pos[data-state="open"]{ animation:lab-modal-in .4s var(--lg-spring); }
.lab-modal-pos[data-state="closed"]{ animation:lab-modal-out .22s ease; }
@keyframes lab-modal-in{ from{opacity:0; transform:translate(-50%,-46%) scale(.96)} to{opacity:1; transform:translate(-50%,-50%) scale(1)} }
@keyframes lab-modal-out{ from{opacity:1} to{opacity:0; transform:translate(-50%,-48%) scale(.98)} }
.lab-modal{ position:relative; padding:26px; } .lab-modal > *{ position:relative; z-index:1; }
.lab-modal-title{ font-size:19px; font-weight:720; letter-spacing:-.02em; }
.lab-modal-body{ font-size:14px; color:var(--lg-ink-2); line-height:1.5; margin:8px 0 20px; }
.lab-modal-actions{ display:flex; gap:10px; }
.lab-modal-x{ position:absolute; top:16px; right:16px; width:30px; height:30px; border-radius:50%; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; z-index:2; } .lab-modal-x svg{ width:13px; height:13px; }
.lab-drawer-pos{ position:fixed; z-index:61; top:0; right:0; height:100%; width:min(380px,calc(100vw - 40px)); outline:none; }
.lab-drawer-pos[data-state="open"]{ animation:lab-drawer-in .4s var(--lg-ease); }
.lab-drawer-pos[data-state="closed"]{ animation:lab-drawer-out .28s ease; }
@keyframes lab-drawer-in{ from{transform:translateX(100%)} to{transform:translateX(0)} }
@keyframes lab-drawer-out{ from{transform:translateX(0)} to{transform:translateX(100%)} }
.lab-drawer{ height:100%; padding:24px; display:flex; flex-direction:column; gap:14px; } .lab-drawer > *{ position:relative; z-index:1; }
.lab-drawer-grip{ position:absolute; top:50%; left:8px; width:5px; height:46px; border-radius:999px; background:var(--lg-line); transform:translateY(-50%); cursor:grab; touch-action:none; z-index:3; }
.lab-drawer .lgbtn{ margin-top:auto; }

/* 6 · refraction */
.lab-refract-stage{ position:relative; width:100%; max-width:360px; height:200px; border-radius:16px; overflow:hidden; }
.lab-refract-content{ position:absolute; inset:0; display:grid; grid-template-columns:1fr 1fr; align-content:center; gap:6px; padding:18px; }
.lab-refract-content span{ font-size:26px; font-weight:800; letter-spacing:-.02em; color:rgba(255,255,255,0.14); }
.lab-blob{ position:absolute; border-radius:50%; filter:blur(10px); } .lab-blob.a{ width:120px; height:120px; left:-20px; top:-20px; background:#5e5ce6; } .lab-blob.b{ width:140px; height:140px; right:-30px; bottom:-30px; background:#30c8a0; } .lab-blob.c{ width:90px; height:90px; right:40px; top:-10px; background:#ff9f0a; }
.lab-lens{ position:absolute; z-index:2; top:60px; left:120px; width:110px; height:110px; cursor:grab; touch-action:none; display:grid; place-items:center; box-shadow:0 14px 34px rgba(0,0,0,0.3) !important; }
.lab-lens:active{ cursor:grabbing; }
.lab-lens-hint{ font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:rgba(255,255,255,0.85); pointer-events:none; position:relative; z-index:1; text-shadow:0 1px 3px rgba(0,0,0,0.4); }

.lab-foot{ margin-top:30px; font-size:11.5px; color:var(--lg-ink-3); line-height:1.6; } .lab-foot code{ font-family:ui-monospace,monospace; background:var(--lg-fill); padding:1px 6px; border-radius:6px; }

@media (prefers-reduced-motion: reduce){ .lab-root *{ animation:none !important; } }
`;
