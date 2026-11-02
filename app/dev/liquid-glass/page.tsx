"use client";
// /dev/liquid-glass — CONCEPT. Generic Apple "Liquid Glass" component gallery.
// Dev-only, blocks in production. NOT tied to TSP: own font, own system palette,
// own iOS-style wallpaper. Pure Apple components, as many as possible.
//
// Every glass surface uses the in-house <LiquidGlass> engine (LiquidGlass.tsx):
// canvas edge-displacement map + 3-pass chromatic aberration → real rim refraction.

import { useState, type PointerEvent as RPointerEvent } from "react";
import { notFound } from "next/navigation";
import {
  Airplane, WifiHigh, Bluetooth, CellSignalFull, Flashlight, Timer, Calculator,
  Camera, Moon, Sun, SunDim, SpeakerHigh, SpeakerSimpleX, Play, Pause, SkipBack,
  SkipForward, Phone, MapTrifold, MusicNotes, GearSix, Alarm, Plus, Minus,
  MagnifyingGlass, Bell, CaretLeft, CaretRight, CaretDown, Check, X, CloudSun,
  CalendarBlank, Heart, Star, Copy, Trash, ShareNetwork, Bookmark, DotsThree,
  BatteryHigh, ChatCircleDots, EnvelopeSimple, Compass, DropHalf, ArrowClockwise,
} from "@phosphor-icons/react";
import { LiquidGlass } from "./LiquidGlass";

const SCENES: Record<string, { label: string; bg: string }> = {
  aqua: {
    label: "Aqua",
    bg: `radial-gradient(60% 55% at 20% 18%, #5ac8fa 0%, transparent 58%),
         radial-gradient(55% 50% at 85% 20%, #5e5ce6 0%, transparent 55%),
         radial-gradient(70% 65% at 75% 92%, #30d0c6 0%, transparent 60%),
         radial-gradient(60% 60% at 18% 90%, #0a84ff 0%, transparent 60%),
         linear-gradient(150deg, #0a1430 0%, #122a63 55%, #0c3b5e 100%)`,
  },
  sunrise: {
    label: "Sunrise",
    bg: `radial-gradient(55% 55% at 22% 20%, #ff9f0a 0%, transparent 56%),
         radial-gradient(55% 50% at 82% 22%, #ff375f 0%, transparent 55%),
         radial-gradient(70% 70% at 72% 90%, #bf5af2 0%, transparent 60%),
         radial-gradient(55% 55% at 16% 88%, #ff2d55 0%, transparent 60%),
         linear-gradient(150deg, #2a0f2e 0%, #5b1b3d 55%, #7a2a1e 100%)`,
  },
  night: {
    label: "Night",
    bg: `radial-gradient(55% 50% at 25% 22%, #5e5ce6 0%, transparent 55%),
         radial-gradient(55% 50% at 82% 24%, #0a84ff 0%, transparent 55%),
         radial-gradient(65% 60% at 72% 88%, #3634a3 0%, transparent 60%),
         linear-gradient(160deg, #05060f 0%, #0b1029 55%, #141438 100%)`,
  },
  graphite: {
    label: "Graphite",
    bg: `radial-gradient(60% 60% at 30% 24%, #48484a 0%, transparent 60%),
         radial-gradient(50% 50% at 82% 82%, #636366 0%, transparent 60%),
         linear-gradient(155deg, #0a0a0c 0%, #1a1a1e 60%, #26262b 100%)`,
  },
};

const APPS = [
  { name: "Phone", icon: <Phone weight="fill" />, bg: "linear-gradient(180deg,#3edc69,#1fb954)" },
  { name: "Messages", icon: <ChatCircleDots weight="fill" />, bg: "linear-gradient(180deg,#4be05a,#28c23f)" },
  { name: "Mail", icon: <EnvelopeSimple weight="fill" />, bg: "linear-gradient(180deg,#36b9ff,#0a84ff)" },
  { name: "Maps", icon: <MapTrifold weight="fill" />, bg: "linear-gradient(180deg,#7ed957,#34c759)" },
  { name: "Music", icon: <MusicNotes weight="fill" />, bg: "linear-gradient(180deg,#ff5c6c,#fa233b)" },
  { name: "Camera", icon: <Camera weight="fill" />, bg: "linear-gradient(180deg,#5a5a5e,#2c2c2e)" },
  { name: "Weather", icon: <CloudSun weight="fill" />, bg: "linear-gradient(180deg,#36b9ff,#1572e8)" },
  { name: "Settings", icon: <GearSix weight="fill" />, bg: "linear-gradient(180deg,#9a9aa0,#636366)" },
];

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="lg-section">
      <div className="lg-section-head">
        <span className="lg-section-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function LiquidGlassShowcase() {
  if (process.env.NODE_ENV === "production") notFound();

  const [scene, setScene] = useState<keyof typeof SCENES>("aqua");
  const [seg, setSeg] = useState(0);
  const [sw, setSw] = useState({ airplane: false, wifi: true, bt: true, cell: true });
  const [toggles, setToggles] = useState({ a: true, b: false, c: true });
  const [bright, setBright] = useState(70);
  const [vol, setVol] = useState(45);
  const [stepper, setStepper] = useState(2);
  const [island, setIsland] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [alert, setAlert] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [cc, setCc] = useState<Record<string, boolean>>({ flash: false, focus: true });
  const [lens, setLens] = useState({ x: 0, y: 0, dragging: false });

  const track = (e: RPointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const onLensDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setLens((l) => ({ ...l, dragging: true }));
  };
  const onLensMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!lens.dragging) return;
    setLens((l) => ({ ...l, x: l.x + e.movementX, y: l.y + e.movementY }));
  };
  const onLensUp = () => setLens((l) => ({ ...l, dragging: false }));

  return (
    <div className="lg-root" data-scene={scene}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="lg-scene" style={{ background: SCENES[scene].bg }}>
        <div className="lg-scene-drift" />
      </div>

      {/* Draggable refracting lens */}
      <LiquidGlass
        radius={78} thickness={30} displace={120} aberration={10} blur={1}
        tint="rgba(255,255,255,0.05)" className="lg-lens"
        style={{ transform: `translate(${lens.x}px, ${lens.y}px)` }}
        onPointerDown={onLensDown} onPointerMove={onLensMove} onPointerUp={onLensUp}
        role="button" aria-label="Drag the lens"
      >
        <span className="lg-lens-hint">drag</span>
      </LiquidGlass>

      <main className="lg-wrap">
        <header className="lg-head">
          <div className="lg-eyebrow"><Sparkle /> Liquid Glass · Apple kit</div>
          <h1>Apple Liquid Glass. The whole kit.</h1>
          <p>
            Real rim refraction and chromatic aberration — the iOS 26 / macOS Tahoe material, rebuilt for the web
            with no dependency. Drag the lens, hover anything, switch the wallpaper.
          </p>
          <div className="lg-scene-switch" role="tablist">
            {(Object.keys(SCENES) as (keyof typeof SCENES)[]).map((k) => (
              <button key={k} role="tab" aria-selected={scene === k}
                className={`lg-scene-btn ${scene === k ? "is-on" : ""}`} onClick={() => setScene(k)}>
                {SCENES[k].label}
              </button>
            ))}
          </div>
        </header>

        {/* ───────── DYNAMIC ISLAND + STATUS ───────── */}
        <Section kicker="Dynamic Island" title="The pill">
          <div className="lg-island-stage">
            <LiquidGlass radius={island ? 34 : 999} thickness={14} displace={island ? 50 : 40} aberration={6}
              className={`lg-island ${island ? "big" : ""}`} onClick={() => setIsland((v) => !v)} role="button" aria-label="Toggle island">
              {!island ? (
                <div className="lg-island-compact">
                  <span className="lg-island-dot" /><MusicNotes weight="fill" /><span className="lg-island-wave"><i /><i /><i /><i /></span>
                </div>
              ) : (
                <div className="lg-island-expanded">
                  <span className="lg-island-art"><MusicNotes weight="fill" /></span>
                  <div className="lg-island-meta"><strong>Midnight City</strong><span>M83</span></div>
                  <button className="lg-island-play" onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}>
                    {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
                  </button>
                </div>
              )}
            </LiquidGlass>
          </div>
          <div className="lg-statusbar-row">
            <LiquidGlass radius={999} thickness={7} displace={26} className="lg-statuspill"><CellSignalFull weight="fill" /><WifiHigh weight="fill" /><span>5G</span></LiquidGlass>
            <LiquidGlass radius={999} thickness={7} displace={26} className="lg-statuspill"><BatteryHigh weight="fill" /> 82%</LiquidGlass>
            <LiquidGlass radius={999} thickness={7} displace={26} className="lg-statuspill"><Moon weight="fill" /> Focus</LiquidGlass>
          </div>
        </Section>

        {/* ───────── BUTTONS ───────── */}
        <Section kicker="Buttons" title="Every iOS button style">
          <div className="lg-tiles">
            <button className="lg-btn filled" onPointerMove={track}>Filled</button>
            <button className="lg-btn tinted" onPointerMove={track}>Tinted</button>
            <button className="lg-btn gray" onPointerMove={track}>Gray</button>
            <button className="lg-btn bordered" onPointerMove={track}>Bordered</button>
            <button className="lg-btn plain" onPointerMove={track}>Plain</button>
            <button className="lg-btn destructive" onPointerMove={track}>Delete</button>
            <LiquidGlass radius={999} thickness={11} displace={42} className="lg-btn-glass" role="button" onPointerMove={track}><Plus weight="bold" /> Glass</LiquidGlass>
            <LiquidGlass radius={999} thickness={10} displace={40} className="lg-iconbtn" role="button" aria-label="Share"><ShareNetwork weight="bold" /></LiquidGlass>
          </div>
          <button className="lg-btn filled full lg-mt">Continue</button>
        </Section>

        {/* ───────── CONTROLS ───────── */}
        <Section kicker="Controls" title="Switches, sliders, segmented, stepper">
          <div className="lg-grid-2">
            <LiquidGlass radius={22} className="lg-spec lg-pad" onPointerMove={track}>
              <label className="lg-label">Segmented</label>
              <div className="lg-seg" style={{ ["--i" as string]: String(seg), ["--n" as string]: "3" }}>
                <div className="lg-seg-thumb" />
                {["Photos", "Live", "Portrait"].map((t, i) => (<button key={t} className={`lg-seg-btn ${seg === i ? "is-on" : ""}`} onClick={() => setSeg(i)}>{t}</button>))}
              </div>
              <label className="lg-label mt">Switches</label>
              <div className="lg-switch-rows">
                {([["a", "Wi-Fi"], ["b", "Airplane Mode"], ["c", "Bluetooth"]] as const).map(([k, lab]) => (
                  <div key={k} className="lg-switch-row"><span>{lab}</span>
                    <button className={`lg-switch ${toggles[k] ? "on" : ""}`} onClick={() => setToggles((s) => ({ ...s, [k]: !s[k] }))} role="switch" aria-checked={toggles[k]}><span className="lg-switch-knob" /></button>
                  </div>
                ))}
              </div>
              <label className="lg-label mt">Stepper</label>
              <div className="lg-stepper">
                <button onClick={() => setStepper((v) => Math.max(0, v - 1))}><Minus weight="bold" /></button>
                <span>{stepper}</span>
                <button onClick={() => setStepper((v) => v + 1)}><Plus weight="bold" /></button>
              </div>
            </LiquidGlass>

            <LiquidGlass radius={22} className="lg-spec lg-pad" onPointerMove={track}>
              <label className="lg-label">Brightness</label>
              <div className="lg-vslider-row">
                <div className="lg-islider"><div className="lg-islider-fill" style={{ width: `${bright}%` }} /><SunDim weight="fill" className="lg-islider-ic" />
                  <input type="range" min={0} max={100} value={bright} onChange={(e) => setBright(+e.target.value)} /></div>
              </div>
              <label className="lg-label mt">Volume</label>
              <div className="lg-islider"><div className="lg-islider-fill" style={{ width: `${vol}%` }} /><SpeakerHigh weight="fill" className="lg-islider-ic" />
                <input type="range" min={0} max={100} value={vol} onChange={(e) => setVol(+e.target.value)} /></div>
              <label className="lg-label mt">Search</label>
              <div className="lg-search"><MagnifyingGlass weight="bold" /><input placeholder="Search" /><SpeakerSimpleX weight="fill" className="lg-search-mic" /></div>
            </LiquidGlass>
          </div>
        </Section>

        {/* ───────── CONTROL CENTER ───────── */}
        <Section kicker="Control Center" title="The module grid">
          <div className="lg-cc-grid">
            {/* Connectivity quad */}
            <LiquidGlass radius={28} thickness={16} displace={48} className="lg-cc-tile quad">
              {([["airplane", Airplane, "Airplane"], ["cell", CellSignalFull, "Cellular"], ["wifi", WifiHigh, "Wi-Fi"], ["bt", Bluetooth, "Bluetooth"]] as const).map(([k, Ic, lab]) => (
                <button key={k} className={`lg-cc-conn ${sw[k] ? "on" : ""}`} onClick={() => setSw((s) => ({ ...s, [k]: !s[k] }))}>
                  <span className="lg-cc-conn-ic"><Ic weight="fill" /></span><span className="lg-cc-conn-lab">{lab}</span>
                </button>
              ))}
            </LiquidGlass>

            {/* Now playing */}
            <LiquidGlass radius={28} thickness={16} displace={48} className="lg-cc-tile np">
              <div className="lg-np-top"><span className="lg-np-art"><MusicNotes weight="fill" /></span><div><strong>Midnight City</strong><span>M83</span></div></div>
              <div className="lg-np-ctl"><button onClick={() => {}}><SkipBack weight="fill" /></button><button className="lg-np-play" onClick={() => setPlaying((p) => !p)}>{playing ? <Pause weight="fill" /> : <Play weight="fill" />}</button><button><SkipForward weight="fill" /></button></div>
            </LiquidGlass>

            {/* Vertical brightness */}
            <LiquidGlass radius={28} thickness={16} displace={48} className="lg-cc-tile vtile">
              <div className="lg-vfill" style={{ height: `${bright}%` }} /><SunDim weight="fill" className="lg-vtile-ic" />
            </LiquidGlass>
            {/* Vertical volume */}
            <LiquidGlass radius={28} thickness={16} displace={48} className="lg-cc-tile vtile">
              <div className="lg-vfill" style={{ height: `${vol}%` }} /><SpeakerHigh weight="fill" className="lg-vtile-ic" />
            </LiquidGlass>

            {/* Round toggles */}
            <div className="lg-cc-rounds">
              {([[Flashlight, "flash"], [Timer, null], [Calculator, null], [Camera, null], [Moon, "focus"], [ArrowClockwise, null]] as const).map(([Ic, key], i) => {
                const on = key ? cc[key] : false;
                return (
                  <LiquidGlass key={i} radius={999} thickness={11} displace={40} className={`lg-cc-round ${on ? "on" : ""}`} role="button"
                    onClick={() => key && setCc((s) => ({ ...s, [key]: !s[key] }))}><Ic weight="fill" /></LiquidGlass>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ───────── WIDGETS ───────── */}
        <Section kicker="Home Screen" title="Widgets & activity">
          <div className="lg-widgets">
            <LiquidGlass radius={26} thickness={16} displace={50} className="lg-spec lg-widget weather" onPointerMove={track}>
              <div className="lg-wx-top"><span>Cupertino</span><CloudSun weight="fill" /></div>
              <div className="lg-wx-temp">21°</div>
              <div className="lg-wx-cond">Partly Cloudy</div>
              <div className="lg-wx-row">{["12", "1", "2", "3", "4"].map((h, i) => (<div key={h} className="lg-wx-hr"><span>{h}</span><DropHalf weight="fill" /><b>{21 - i}°</b></div>))}</div>
            </LiquidGlass>

            <LiquidGlass radius={26} thickness={16} displace={50} className="lg-spec lg-widget cal" onPointerMove={track}>
              <div className="lg-cal-day">THU</div><div className="lg-cal-num">18</div>
              <div className="lg-cal-evt"><span className="lg-cal-bar" /><div><strong>Design review</strong><span>10:00 – 11:00</span></div></div>
              <div className="lg-cal-evt"><span className="lg-cal-bar green" /><div><strong>Lunch</strong><span>13:00</span></div></div>
            </LiquidGlass>

            <LiquidGlass radius={26} thickness={16} displace={50} className="lg-widget rings-w">
              <div className="lg-rings">
                <span className="lg-ar r1" /><span className="lg-ar r2" /><span className="lg-ar r3" />
              </div>
              <div className="lg-rings-meta"><b style={{ color: "#fa2d55" }}>480</b><b style={{ color: "#a4ff00" }}>32</b><b style={{ color: "#00e5ff" }}>11</b></div>
            </LiquidGlass>
          </div>
        </Section>

        {/* ───────── NOTIFICATIONS ───────── */}
        <Section kicker="Notifications" title="Banners & stacks">
          <div className="lg-noti-stack">
            <LiquidGlass radius={20} thickness={13} displace={44} className="lg-noti">
              <span className="lg-noti-ic" style={{ background: "linear-gradient(180deg,#4be05a,#28c23f)" }}><ChatCircleDots weight="fill" /></span>
              <div className="lg-noti-body"><div className="lg-noti-head"><strong>Messages</strong><span>now</span></div><p>Alex: Just landed, see you in 20 👋</p></div>
            </LiquidGlass>
            <LiquidGlass radius={20} thickness={13} displace={44} className="lg-noti">
              <span className="lg-noti-ic" style={{ background: "linear-gradient(180deg,#36b9ff,#0a84ff)" }}><EnvelopeSimple weight="fill" /></span>
              <div className="lg-noti-body"><div className="lg-noti-head"><strong>Mail</strong><span>9:41</span></div><p>Your receipt from the App Store</p></div>
            </LiquidGlass>
            <div className="lg-noti-ghost two" /><div className="lg-noti-ghost three" />
          </div>
        </Section>

        {/* ───────── OVERLAYS ───────── */}
        <Section kicker="Overlays" title="Alerts, sheets & menus">
          <div className="lg-row gap wrap">
            <button className="lg-btn filled" onClick={() => setAlert(true)}>Show alert</button>
            <button className="lg-btn gray" onClick={() => setSheet(true)}>Action sheet</button>
            <div className="lg-pop-anchor">
              <button className="lg-iconbtn-sq" onClick={() => setMenu((v) => !v)} aria-label="Menu"><DotsThree weight="bold" /></button>
              {menu && (
                <LiquidGlass radius={16} thickness={12} displace={42} className="lg-ctx">
                  {[[Copy, "Copy"], [ShareNetwork, "Share"], [Bookmark, "Save"], [Star, "Favourite"]].map(([Ic, t], i) => { const Icon = Ic as typeof Copy; return (<button key={i} className="lg-ctx-item" onClick={() => setMenu(false)}><span>{t as string}</span><Icon weight="bold" /></button>); })}
                  <div className="lg-ctx-sep" />
                  <button className="lg-ctx-item danger" onClick={() => setMenu(false)}><span>Delete</span><Trash weight="bold" /></button>
                </LiquidGlass>
              )}
            </div>
          </div>
        </Section>

        {/* ───────── APPS + DOCK ───────── */}
        <Section kicker="Home & Dock" title="App icons, dock, tab bar">
          <div className="lg-apps">
            {APPS.map((a) => (<div key={a.name} className="lg-app"><span className="lg-app-ic" style={{ background: a.bg }}>{a.icon}</span><span className="lg-app-name">{a.name}</span></div>))}
          </div>

          <div className="lg-pagedots">{[0, 1, 2].map((d) => (<button key={d} className={`lg-pagedot ${page === d ? "on" : ""}`} onClick={() => setPage(d)} aria-label={`Page ${d + 1}`} />))}</div>

          <div className="lg-dock-wrap">
            <LiquidGlass radius={32} thickness={18} displace={54} className="lg-dock" onPointerMove={track}>
              {APPS.slice(0, 4).map((a) => (<span key={a.name} className="lg-app-ic dock" style={{ background: a.bg }}>{a.icon}</span>))}
            </LiquidGlass>
          </div>

          <LiquidGlass radius={28} thickness={16} displace={50} className="lg-tabbar">
            {[[Compass, "Home"], [MagnifyingGlass, "Search"], [Heart, "Favourites"], [GearSix, "Settings"]].map(([Ic, t], i) => { const Icon = Ic as typeof Compass; return (<button key={i} className={`lg-tabitem ${tab === i ? "on" : ""}`} onClick={() => setTab(i)}><Icon weight="fill" /><span>{t as string}</span></button>); })}
          </LiquidGlass>
        </Section>

        <footer className="lg-foot">
          <span>Refraction: canvas displacement map + 3-pass chromatic aberration on <code>backdrop-filter: url()</code>. Full effect in Chromium/Edge; Safari &amp; Firefox fall back to frosted blur. Font falls back to Segoe UI on Windows (no SF Pro installed).</span>
        </footer>
      </main>

      {/* iOS centred alert */}
      {alert && (
        <div className="lg-overlay" onClick={() => setAlert(false)}>
          <LiquidGlass radius={26} thickness={16} displace={44} className="lg-alert-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Allow “Maps” to use your location?</h3>
            <p>Your location is used to show where you are on the map and get directions.</p>
            <div className="lg-alert-btns">
              <button onClick={() => setAlert(false)}>Don’t Allow</button>
              <button className="bold" onClick={() => setAlert(false)}>Allow Once</button>
            </div>
          </LiquidGlass>
        </div>
      )}

      {/* iOS action sheet */}
      {sheet && (
        <div className="lg-overlay end" onClick={() => setSheet(false)}>
          <div className="lg-sheet-col" onClick={(e) => e.stopPropagation()}>
            <LiquidGlass radius={20} thickness={14} displace={44} className="lg-actionsheet">
              {[[Camera, "Take Photo"], [Bookmark, "Add to Favourites"], [ShareNetwork, "Share"], [Trash, "Delete", true]].map(([Ic, t, d], i) => { const Icon = Ic as typeof Camera; return (<button key={i} className={`lg-as-item ${d ? "danger" : ""}`} onClick={() => setSheet(false)}><Icon weight="bold" /> {t as string}</button>); })}
            </LiquidGlass>
            <LiquidGlass radius={20} thickness={14} displace={44} className="lg-actionsheet cancel">
              <button className="lg-as-item cancel" onClick={() => setSheet(false)}>Cancel</button>
            </LiquidGlass>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal sparkle (avoid extra import name clash)
function Sparkle() {
  return (<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden><path d="M8 0l1.6 4.8L14.4 6.4 9.6 8 8 12.8 6.4 8 1.6 6.4 6.4 4.8z" /></svg>);
}

const CSS = `
.lg-root{
  --blue:#0a84ff; --green:#30d158; --red:#ff453a; --orange:#ff9f0a; --yellow:#ffd60a;
  --purple:#bf5af2; --pink:#ff375f; --teal:#40c8e0; --indigo:#5e5ce6;
  position:relative; min-height:100vh; overflow:hidden; isolation:isolate; color:#fff;
  font-family:-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing:antialiased; letter-spacing:-0.01em;
}

/* ── Glass surface base (fallback blur; LiquidGlass layers url() on top) ──── */
.lgx-surface{
  position:relative; border:1px solid rgba(255,255,255,0.22);
  -webkit-backdrop-filter:blur(9px) saturate(180%); backdrop-filter:blur(9px) saturate(180%);
  box-shadow:0 10px 30px rgba(0,0,0,0.24), 0 2px 6px rgba(0,0,0,0.16), inset 0 1px 1px rgba(255,255,255,0.55), inset 0 0 0 1px rgba(255,255,255,0.07);
  transition:transform .5s cubic-bezier(.2,.8,.2,1), box-shadow .5s ease, border-radius .4s ease;
}
.lgx-surface::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent) top/100% 1px no-repeat, linear-gradient(180deg,rgba(255,255,255,0.38),transparent 42%) left/1px 100% no-repeat;
  mix-blend-mode:screen; opacity:.7; }
.lgx-filter-svg{ position:absolute; width:0; height:0; overflow:hidden; pointer-events:none; }
.lg-spec::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:0;
  background:radial-gradient(180px 180px at var(--mx,50%) var(--my,0%), rgba(255,255,255,0.38), rgba(255,255,255,0.1) 38%, transparent 64%); opacity:0; transition:opacity .35s; mix-blend-mode:screen; }
.lg-spec:hover::after{ opacity:1; } .lg-spec:hover{ transform:translateY(-3px); }

/* ── Scene ─────────────────────────────────────────────────────────────── */
.lg-scene{ position:absolute; inset:0; z-index:0; background-size:cover !important; }
.lg-scene-drift{ position:absolute; inset:-20%; background:radial-gradient(40% 40% at 30% 30%, rgba(255,255,255,0.1), transparent 60%), radial-gradient(35% 35% at 70% 65%, rgba(255,255,255,0.08), transparent 60%); animation:lg-drift 28s ease-in-out infinite alternate; filter:blur(10px); }
@keyframes lg-drift{ from{transform:translate3d(-3%,-2%,0)} to{transform:translate3d(4%,3%,0)} }
@media (prefers-reduced-motion: reduce){ .lg-scene-drift{ animation:none } }

/* ── Layout / header ───────────────────────────────────────────────────── */
.lg-wrap{ position:relative; z-index:2; max-width:1040px; margin:0 auto; padding:60px 24px 140px; }
.lg-head{ max-width:640px; margin-bottom:40px; }
.lg-head h1{ font-size:clamp(34px,5vw,54px); line-height:1.03; letter-spacing:-.03em; font-weight:800; margin:16px 0 14px; text-shadow:0 2px 24px rgba(0,0,0,0.3); }
.lg-head p{ font-size:17px; line-height:1.55; color:rgba(255,255,255,0.82); text-shadow:0 1px 10px rgba(0,0,0,0.25); }
.lg-eyebrow{ display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:650; padding:7px 13px; border-radius:999px; color:#fff; background:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.3); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); box-shadow:inset 0 1px 1px rgba(255,255,255,0.4); }
.lg-eyebrow svg{ color:var(--yellow); }
.lg-scene-switch{ display:flex; gap:10px; margin-top:26px; flex-wrap:wrap; }
.lg-scene-btn{ font-size:13.5px; font-weight:600; color:#fff; padding:9px 16px; border-radius:999px; cursor:pointer; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.22); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); box-shadow:inset 0 1px 1px rgba(255,255,255,0.35); transition:transform .3s, background .3s, border-color .3s; }
.lg-scene-btn:hover{ transform:translateY(-2px); background:rgba(255,255,255,0.18); }
.lg-scene-btn.is-on{ background:rgba(255,255,255,0.28); border-color:rgba(255,255,255,0.55); }

.lg-section{ margin-top:48px; }
.lg-section-head{ margin-bottom:18px; }
.lg-section-kicker{ font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,0.65); }
.lg-section-head h2{ font-size:24px; font-weight:750; letter-spacing:-.02em; margin-top:4px; text-shadow:0 1px 10px rgba(0,0,0,0.25); }
.lg-mt{ margin-top:14px; } .mt{ margin-top:18px; }
.lg-row{ display:flex; align-items:center; } .lg-row.gap{ gap:12px; } .lg-row.wrap{ flex-wrap:wrap; }
.lg-grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }

/* content above pseudo glass */
.lg-pad>*, .lg-island>*, .lg-cc-tile>*, .lg-widget>*, .lg-noti>*, .lg-dock>*, .lg-tabbar>*, .lg-ctx>*, .lg-actionsheet>*, .lg-alert-dialog>*, .lg-np-top, .lg-np-ctl{ position:relative; z-index:1; }

/* ── Dynamic Island ────────────────────────────────────────────────────── */
.lg-island-stage{ display:flex; justify-content:center; padding:10px 0 18px; }
.lg-island{ cursor:pointer; background:rgba(0,0,0,0.5) !important; border-color:rgba(255,255,255,0.14) !important; display:grid; place-items:center; min-width:128px; height:38px; transition:all .5s cubic-bezier(.3,1.2,.4,1); }
.lg-island.big{ min-width:340px; height:78px; padding:0 18px; }
.lg-island-compact{ display:flex; align-items:center; gap:10px; }
.lg-island-compact svg{ width:16px; height:16px; color:var(--pink); }
.lg-island-dot{ width:9px; height:9px; border-radius:50%; background:var(--green); box-shadow:0 0 8px var(--green); }
.lg-island-wave{ display:flex; align-items:flex-end; gap:2px; height:16px; }
.lg-island-wave i{ width:3px; background:var(--pink); border-radius:2px; animation:lg-wave 1s ease-in-out infinite; }
.lg-island-wave i:nth-child(1){ height:6px; animation-delay:0s } .lg-island-wave i:nth-child(2){ height:14px; animation-delay:.2s } .lg-island-wave i:nth-child(3){ height:9px; animation-delay:.4s } .lg-island-wave i:nth-child(4){ height:12px; animation-delay:.1s }
@keyframes lg-wave{ 0%,100%{ transform:scaleY(.4) } 50%{ transform:scaleY(1) } }
.lg-island-expanded{ display:flex; align-items:center; gap:14px; width:100%; }
.lg-island-art{ width:48px; height:48px; border-radius:12px; display:grid; place-items:center; background:linear-gradient(180deg,#ff5c6c,#fa233b); flex-shrink:0; }
.lg-island-art svg{ width:24px; height:24px; color:#fff; }
.lg-island-meta{ flex:1; } .lg-island-meta strong{ display:block; font-size:15px; } .lg-island-meta span{ font-size:13px; color:rgba(255,255,255,0.6); }
.lg-island-play{ width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.16); border:none; color:#fff; cursor:pointer; display:grid; place-items:center; }
.lg-island-play svg{ width:20px; height:20px; }
.lg-statusbar-row{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.lg-statuspill{ display:inline-flex; align-items:center; gap:7px; padding:7px 14px; font-size:13px; font-weight:650; }
.lg-statuspill svg{ width:15px; height:15px; position:relative; z-index:1; }
.lg-statuspill span{ position:relative; z-index:1; }

/* ── Buttons ───────────────────────────────────────────────────────────── */
.lg-tiles{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
.lg-btn{ display:inline-flex; align-items:center; gap:8px; font-size:15px; font-weight:600; cursor:pointer; padding:12px 22px; border-radius:14px; color:#fff; border:none; position:relative; overflow:hidden; transition:transform .35s cubic-bezier(.2,.9,.2,1.2), filter .3s, background .3s; }
.lg-btn svg{ width:16px; height:16px; }
.lg-btn::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:radial-gradient(120px 90px at var(--mx,50%) var(--my,0%), rgba(255,255,255,0.4), transparent 60%); opacity:0; transition:opacity .3s; mix-blend-mode:screen; }
.lg-btn:hover::after{ opacity:1; } .lg-btn:active{ transform:scale(.96); }
.lg-btn.full{ width:100%; justify-content:center; border-radius:16px; padding:16px; font-size:17px; }
.lg-btn.filled{ background:var(--blue); box-shadow:0 6px 18px rgba(10,132,255,0.4); }
.lg-btn.tinted{ background:rgba(10,132,255,0.22); color:#6cb6ff; }
.lg-btn.gray{ background:rgba(120,120,128,0.36); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); }
.lg-btn.bordered{ background:transparent; border:1px solid rgba(255,255,255,0.4); }
.lg-btn.plain{ background:transparent; color:var(--blue); padding-left:10px; padding-right:10px; }
.lg-btn.plain{ color:#6cb6ff; }
.lg-btn.destructive{ background:rgba(255,69,58,0.2); color:#ff6961; }
.lg-btn-glass{ display:inline-flex; align-items:center; gap:8px; padding:12px 22px; font-size:15px; font-weight:650; color:#fff; cursor:pointer; }
.lg-btn-glass svg{ width:16px; height:16px; position:relative; z-index:1; }
.lg-iconbtn{ width:48px; height:48px; display:grid; place-items:center; cursor:pointer; color:#fff; }
.lg-iconbtn svg{ width:20px; height:20px; position:relative; z-index:1; }

/* ── Controls ──────────────────────────────────────────────────────────── */
.lg-pad{ padding:22px 24px; }
.lg-label{ display:block; font-size:12.5px; font-weight:600; color:rgba(255,255,255,0.7); margin-bottom:10px; } .lg-label.mt{ margin-top:20px; }
.lg-seg{ --i:0; --n:3; position:relative; display:grid; grid-template-columns:repeat(var(--n),1fr); gap:0; padding:3px; border-radius:11px; background:rgba(0,0,0,0.28); }
.lg-seg-thumb{ position:absolute; top:3px; left:3px; bottom:3px; width:calc((100% - 6px)/var(--n)); border-radius:9px; background:rgba(120,120,128,0.6); box-shadow:0 2px 6px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.3); transform:translateX(calc(var(--i)*100%)); transition:transform .4s cubic-bezier(.3,1.3,.4,1); }
.lg-seg-btn{ position:relative; z-index:1; padding:8px 0; font-size:13.5px; font-weight:600; cursor:pointer; color:rgba(255,255,255,0.7); background:none; border:none; transition:color .3s; }
.lg-seg-btn.is-on{ color:#fff; }
.lg-switch-rows{ display:flex; flex-direction:column; gap:12px; }
.lg-switch-row{ display:flex; align-items:center; justify-content:space-between; font-size:15px; font-weight:500; }
.lg-switch{ width:52px; height:31px; border-radius:999px; cursor:pointer; position:relative; padding:0; border:none; background:rgba(120,120,128,0.5); transition:background .35s; }
.lg-switch.on{ background:var(--green); }
.lg-switch-knob{ position:absolute; top:2px; left:2px; width:27px; height:27px; border-radius:50%; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,0.3); transition:transform .35s cubic-bezier(.3,1.4,.4,1); }
.lg-switch.on .lg-switch-knob{ transform:translateX(21px); }
.lg-stepper{ display:inline-flex; align-items:center; background:rgba(120,120,128,0.36); border-radius:12px; overflow:hidden; }
.lg-stepper button{ width:48px; height:40px; background:none; border:none; color:#fff; cursor:pointer; display:grid; place-items:center; transition:background .2s; } .lg-stepper button:hover{ background:rgba(255,255,255,0.12); } .lg-stepper button svg{ width:16px; height:16px; }
.lg-stepper span{ min-width:40px; text-align:center; font-size:16px; font-weight:650; border-left:1px solid rgba(255,255,255,0.14); border-right:1px solid rgba(255,255,255,0.14); align-self:stretch; display:grid; place-items:center; }
.lg-islider{ position:relative; height:44px; border-radius:14px; background:rgba(120,120,128,0.34); overflow:hidden; display:flex; align-items:center; }
.lg-islider-fill{ position:absolute; left:0; top:0; bottom:0; background:rgba(255,255,255,0.9); }
.lg-islider-ic{ position:relative; z-index:2; width:18px; height:18px; margin-left:14px; color:#1a1a1a; mix-blend-mode:difference; }
.lg-islider input{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; margin:0; }
.lg-search{ display:flex; align-items:center; gap:9px; padding:10px 14px; border-radius:12px; background:rgba(120,120,128,0.3); }
.lg-search svg{ width:16px; height:16px; color:rgba(255,255,255,0.6); }
.lg-search input{ flex:1; background:none; border:none; outline:none; color:#fff; font-size:15px; } .lg-search input::placeholder{ color:rgba(255,255,255,0.55); }
.lg-search-mic{ color:rgba(255,255,255,0.5) !important; }

/* ── Control Center ────────────────────────────────────────────────────── */
.lg-cc-grid{ display:grid; grid-template-columns:repeat(4,1fr); grid-auto-rows:88px; gap:14px; }
.lg-cc-tile{ padding:14px 16px; }
.lg-cc-tile.quad{ grid-column:span 2; grid-row:span 2; display:grid; grid-template-columns:1fr 1fr; gap:6px; align-content:center; }
.lg-cc-conn{ display:flex; align-items:center; gap:10px; background:none; border:none; color:#fff; cursor:pointer; padding:6px; border-radius:12px; transition:background .2s; }
.lg-cc-conn-ic{ width:40px; height:40px; border-radius:50%; display:grid; place-items:center; background:rgba(120,120,128,0.5); transition:background .3s, box-shadow .3s; flex-shrink:0; }
.lg-cc-conn-ic svg{ width:18px; height:18px; }
.lg-cc-conn-lab{ font-size:12px; font-weight:600; line-height:1.1; text-align:left; }
.lg-cc-conn.on .lg-cc-conn-ic{ background:var(--blue); box-shadow:0 0 14px rgba(10,132,255,0.5); }
.lg-cc-tile.np{ grid-column:span 2; grid-row:span 2; display:flex; flex-direction:column; justify-content:center; gap:14px; }
.lg-np-top{ display:flex; align-items:center; gap:12px; } .lg-np-art{ width:46px; height:46px; border-radius:11px; background:linear-gradient(180deg,#ff5c6c,#fa233b); display:grid; place-items:center; } .lg-np-art svg{ width:22px; height:22px; color:#fff; }
.lg-np-top strong{ display:block; font-size:15px; } .lg-np-top span{ font-size:13px; color:rgba(255,255,255,0.6); }
.lg-np-ctl{ display:flex; align-items:center; justify-content:center; gap:26px; } .lg-np-ctl button{ background:none; border:none; color:#fff; cursor:pointer; } .lg-np-ctl button svg{ width:22px; height:22px; } .lg-np-play svg{ width:28px !important; height:28px !important; }
.lg-cc-tile.vtile{ grid-row:span 2; position:relative; padding:0; overflow:hidden; display:grid; place-items:end center; }
.lg-vfill{ position:absolute; left:0; right:0; bottom:0; background:rgba(255,255,255,0.88); }
.lg-vtile-ic{ position:relative; z-index:1; width:22px; height:22px; margin-bottom:16px; color:#1a1a1a; mix-blend-mode:difference; }
.lg-cc-rounds{ grid-column:span 4; display:flex; gap:14px; flex-wrap:wrap; }
.lg-cc-round{ width:60px; height:60px; display:grid; place-items:center; cursor:pointer; color:#fff; }
.lg-cc-round svg{ width:24px; height:24px; position:relative; z-index:1; }
.lg-cc-round.on{ background:rgba(255,255,255,0.92) !important; } .lg-cc-round.on svg{ color:#1a1a1a; }

/* ── Widgets ───────────────────────────────────────────────────────────── */
.lg-widgets{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.lg-widget{ padding:18px 20px; aspect-ratio:1/1; display:flex; flex-direction:column; }
.lg-widget.weather .lg-wx-top{ display:flex; justify-content:space-between; align-items:center; font-size:15px; font-weight:600; } .lg-wx-top svg{ width:22px; height:22px; color:var(--yellow); }
.lg-wx-temp{ font-size:46px; font-weight:300; margin-top:2px; } .lg-wx-cond{ font-size:13px; color:rgba(255,255,255,0.75); margin-bottom:auto; }
.lg-wx-row{ display:flex; justify-content:space-between; margin-top:12px; } .lg-wx-hr{ display:flex; flex-direction:column; align-items:center; gap:5px; font-size:11px; } .lg-wx-hr span{ color:rgba(255,255,255,0.6); } .lg-wx-hr svg{ width:13px; height:13px; color:#7fd4ff; } .lg-wx-hr b{ font-weight:600; }
.lg-widget.cal .lg-cal-day{ font-size:13px; font-weight:700; color:var(--red); letter-spacing:.04em; } .lg-cal-num{ font-size:34px; font-weight:700; line-height:1; margin-bottom:auto; }
.lg-cal-evt{ display:flex; gap:9px; margin-top:10px; } .lg-cal-bar{ width:3px; border-radius:2px; background:var(--blue); } .lg-cal-bar.green{ background:var(--green); } .lg-cal-evt strong{ display:block; font-size:13px; } .lg-cal-evt span{ font-size:11.5px; color:rgba(255,255,255,0.6); }
.lg-widget.rings-w{ align-items:center; justify-content:center; gap:14px; }
.lg-rings{ position:relative; width:110px; height:110px; }
.lg-ar{ position:absolute; border-radius:50%; }
.lg-ar.r1{ inset:0; background:conic-gradient(#fa2d55 85%, rgba(250,45,85,0.2) 0); -webkit-mask:radial-gradient(farthest-side,transparent 70%,#000 72%); mask:radial-gradient(farthest-side,transparent 70%,#000 72%); }
.lg-ar.r2{ inset:16px; background:conic-gradient(#a4ff00 70%, rgba(164,255,0,0.2) 0); -webkit-mask:radial-gradient(farthest-side,transparent 66%,#000 68%); mask:radial-gradient(farthest-side,transparent 66%,#000 68%); }
.lg-ar.r3{ inset:32px; background:conic-gradient(#00e5ff 55%, rgba(0,229,255,0.2) 0); -webkit-mask:radial-gradient(farthest-side,transparent 62%,#000 64%); mask:radial-gradient(farthest-side,transparent 62%,#000 64%); }
.lg-rings-meta{ display:flex; gap:12px; font-size:15px; } .lg-rings-meta b{ font-weight:700; }

/* ── Notifications ─────────────────────────────────────────────────────── */
.lg-noti-stack{ position:relative; display:flex; flex-direction:column; gap:10px; max-width:460px; }
.lg-noti{ display:flex; gap:12px; padding:14px 16px; align-items:flex-start; }
.lg-noti-ic{ width:38px; height:38px; border-radius:10px; display:grid; place-items:center; flex-shrink:0; } .lg-noti-ic svg{ width:20px; height:20px; color:#fff; }
.lg-noti-body{ flex:1; } .lg-noti-head{ display:flex; justify-content:space-between; font-size:13px; } .lg-noti-head strong{ font-weight:650; } .lg-noti-head span{ color:rgba(255,255,255,0.55); } .lg-noti-body p{ font-size:14px; color:rgba(255,255,255,0.85); margin-top:2px; }
.lg-noti-ghost{ height:20px; border-radius:16px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.14); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); margin:0 auto; }
.lg-noti-ghost.two{ width:94%; margin-top:-6px; } .lg-noti-ghost.three{ width:88%; margin-top:-14px; opacity:.6; }

/* ── Overlays ──────────────────────────────────────────────────────────── */
.lg-pop-anchor{ position:relative; }
.lg-iconbtn-sq{ width:44px; height:44px; border-radius:13px; display:grid; place-items:center; cursor:pointer; color:#fff; background:rgba(120,120,128,0.36); border:1px solid rgba(255,255,255,0.18); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); } .lg-iconbtn-sq svg{ width:22px; height:22px; }
.lg-ctx{ position:absolute; top:calc(100% + 10px); left:0; min-width:230px; padding:6px; z-index:20; display:flex; flex-direction:column; animation:lg-pop-in .22s cubic-bezier(.2,.9,.3,1.1); }
@keyframes lg-pop-in{ from{opacity:0; transform:translateY(-8px) scale(.97)} to{opacity:1; transform:none} }
.lg-ctx-item{ display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; padding:11px 12px; border-radius:10px; font-size:15px; font-weight:500; color:#fff; background:none; border:none; cursor:pointer; text-align:left; transition:background .2s; } .lg-ctx-item svg{ width:17px; height:17px; }
.lg-ctx-item:hover{ background:rgba(255,255,255,0.12); } .lg-ctx-item.danger{ color:var(--red); }
.lg-ctx-sep{ height:1px; background:rgba(255,255,255,0.14); margin:4px 8px; }
.lg-overlay{ position:fixed; inset:0; z-index:50; display:grid; place-items:center; padding:24px; background:rgba(0,0,0,0.42); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); animation:lg-fade .3s; }
.lg-overlay.end{ align-items:flex-end; }
@keyframes lg-fade{ from{opacity:0} to{opacity:1} }
.lg-alert-dialog{ width:min(300px,100%); padding:22px 20px 0; text-align:center; animation:lg-modal-in .35s cubic-bezier(.2,.9,.3,1.05); overflow:hidden; }
@keyframes lg-modal-in{ from{opacity:0; transform:scale(.9)} to{opacity:1; transform:none} }
.lg-alert-dialog h3{ font-size:17px; font-weight:650; } .lg-alert-dialog p{ font-size:13px; color:rgba(255,255,255,0.78); margin:6px 0 18px; line-height:1.4; }
.lg-alert-btns{ display:flex; margin:0 -20px; border-top:1px solid rgba(255,255,255,0.16); } .lg-alert-btns button{ flex:1; padding:14px; background:none; border:none; color:var(--blue); font-size:17px; cursor:pointer; } .lg-alert-btns button:first-child{ border-right:1px solid rgba(255,255,255,0.16); color:#6cb6ff; } .lg-alert-btns .bold{ font-weight:650; color:#6cb6ff; }
.lg-sheet-col{ width:min(460px,100%); display:flex; flex-direction:column; gap:8px; animation:lg-sheet-in .4s cubic-bezier(.2,.9,.3,1.05); }
@keyframes lg-sheet-in{ from{opacity:0; transform:translateY(40px)} to{opacity:1; transform:none} }
.lg-actionsheet{ padding:4px; display:flex; flex-direction:column; } .lg-actionsheet.cancel{ }
.lg-as-item{ padding:16px; background:none; border:none; color:var(--blue); font-size:17px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; border-bottom:1px solid rgba(255,255,255,0.12); color:#6cb6ff; } .lg-as-item:last-child{ border-bottom:none; } .lg-as-item svg{ width:18px; height:18px; } .lg-as-item.danger{ color:var(--red); } .lg-as-item.cancel{ font-weight:650; }

/* ── Apps / dock / tab bar ─────────────────────────────────────────────── */
.lg-apps{ display:grid; grid-template-columns:repeat(8,1fr); gap:18px 14px; }
.lg-app{ display:flex; flex-direction:column; align-items:center; gap:7px; }
.lg-app-ic{ width:60px; height:60px; border-radius:15px; display:grid; place-items:center; box-shadow:0 6px 16px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.35); transition:transform .3s cubic-bezier(.3,1.4,.4,1); }
.lg-app-ic svg{ width:30px; height:30px; color:#fff; } .lg-app:hover .lg-app-ic{ transform:scale(1.1); }
.lg-app-name{ font-size:12px; color:rgba(255,255,255,0.9); }
.lg-pagedots{ display:flex; justify-content:center; gap:8px; margin:22px 0; } .lg-pagedot{ width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.4); border:none; cursor:pointer; transition:background .3s, transform .3s; } .lg-pagedot.on{ background:#fff; transform:scale(1.1); }
.lg-dock-wrap{ display:flex; justify-content:center; }
.lg-dock{ display:inline-flex; gap:16px; padding:14px 18px; } .lg-app-ic.dock{ width:58px; height:58px; }
.lg-tabbar{ display:flex; margin-top:22px; padding:10px 8px; justify-content:space-around; }
.lg-tabitem{ display:flex; flex-direction:column; align-items:center; gap:4px; background:none; border:none; color:rgba(255,255,255,0.6); cursor:pointer; font-size:11px; font-weight:500; padding:4px 14px; border-radius:12px; transition:color .3s; } .lg-tabitem svg{ width:24px; height:24px; } .lg-tabitem.on{ color:var(--blue); } .lg-tabitem.on{ color:#4aa8ff; }

/* ── Lens ──────────────────────────────────────────────────────────────── */
.lg-lens{ position:absolute; z-index:3; top:34%; left:50%; margin:-78px 0 0 -78px; width:156px; height:156px; cursor:grab; touch-action:none; display:grid; place-items:center; }
.lg-lens:active{ cursor:grabbing; } .lg-lens-hint{ font-size:11px; font-weight:700; color:rgba(255,255,255,0.85); letter-spacing:.1em; text-transform:uppercase; pointer-events:none; text-shadow:0 1px 4px rgba(0,0,0,0.4); position:relative; z-index:1; }

/* ── Footer ────────────────────────────────────────────────────────────── */
.lg-foot{ margin-top:46px; font-size:12.5px; line-height:1.6; color:rgba(255,255,255,0.6); max-width:680px; }
.lg-foot code{ font-family:ui-monospace,monospace; font-size:11.5px; background:rgba(255,255,255,0.12); padding:1px 6px; border-radius:6px; }

@media (max-width:880px){
  .lg-grid-2{ grid-template-columns:1fr; }
  .lg-widgets{ grid-template-columns:1fr; }
  .lg-cc-grid{ grid-template-columns:repeat(2,1fr); }
  .lg-cc-tile.quad, .lg-cc-tile.np{ grid-column:span 2; }
  .lg-apps{ grid-template-columns:repeat(4,1fr); }
}
`;
