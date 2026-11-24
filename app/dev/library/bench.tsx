"use client";
// TSP library · Material Bench (Phase 0; isolated to /dev/library; nothing Approved).
//
// The environment for judging the materials: drop the live controls + the three
// material swatches onto switchable backdrops (text, grid, photo, colour bands,
// gradient), in the page's light/dark theme, and drive the accessibility prefs
// (reduced motion / reduced transparency / increased contrast) so you can see the
// real fallbacks. A rough frame-rate meter is shown while you interact. The
// toggles are REAL: they feed EnvCtx, which the foundations honour.

import { useEffect, useRef, useState } from "react";
import { cn, EnvCtx } from "./lib";
import { Surface } from "./foundation";
import { Segmented, Slider } from "./controls";
import { Tabs, FloatingDock } from "./navigation";

const BACKDROPS = [
  { k: "text", label: "Text" }, { k: "grid", label: "Grid" }, { k: "photo", label: "Photo" },
  { k: "bands", label: "Colour bands" }, { k: "gradient", label: "Gradient" },
] as const;
const TEXT_FILL = "Exchange Completion Enquiries Searches Mortgage offer Memorandum of sale Contract pack Management pack Deposit Freehold Leasehold Vendor Purchaser Solicitor ".repeat(14);

function Fps() {
  const [fps, setFps] = useState(60);
  useEffect(() => {
    let raf = 0, frames = 0, last = performance.now();
    const loop = (t: number) => { frames += 1; if (t - last >= 500) { setFps(Math.round((frames * 1000) / (t - last))); frames = 0; last = t; } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  return <span className="tlb-fps" title="Approx. frame rate (watch it while dragging)">{fps} fps</span>;
}
function BenchToggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="tlb-toggle" data-on={on || undefined} onClick={() => set(!on)}>
      <span className="tlb-toggle-track"><span className="tlb-toggle-knob" /></span>{label}
    </button>
  );
}

export function MaterialBench() {
  const [bd, setBd] = useState<(typeof BACKDROPS)[number]["k"]>("bands");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [rm, setRM] = useState(false); const [rt, setRT] = useState(false); const [ct, setCT] = useState(false);
  const [seg, setSeg] = useState("week"); const [tab, setTab] = useState("overview"); const [sv, setSV] = useState(58);
  const stageRef = useRef<HTMLDivElement>(null);
  return (
    <div className="tlb">
      <div className="tlb-bar">
        <div className="tlb-group"><span className="tlb-lab">Backdrop</span><div className="tlb-chips">{BACKDROPS.map((b) => <button key={b.k} className="tlb-chip" data-on={bd === b.k || undefined} onClick={() => setBd(b.k)}>{b.label}</button>)}</div></div>
        <div className="tlb-group"><span className="tlb-lab">Density</span><div className="tlb-chips">{(["comfortable", "compact"] as const).map((d) => <button key={d} className="tlb-chip" data-on={density === d || undefined} onClick={() => setDensity(d)}>{d}</button>)}</div></div>
        <div className="tlb-group tlb-group--grow"><span className="tlb-lab">Accessibility</span><div className="tlb-toggles">
          <BenchToggle on={rm} set={setRM} label="Reduced motion" />
          <BenchToggle on={rt} set={setRT} label="Reduced transparency" />
          <BenchToggle on={ct} set={setCT} label="Increased contrast" />
        </div></div>
        <Fps />
      </div>

      <EnvCtx.Provider value={{ reducedMotion: rm, reducedTransparency: rt, contrast: ct }}>
        <div ref={stageRef} className={cn("tlb-stage", `tlb-bd--${bd}`, `tlb-stage--${density}`)}>
          {bd === "text" && <div className="tlb-textlayer" aria-hidden>{TEXT_FILL}</div>}
          {bd === "grid" && <div className="tlb-gridlayer" aria-hidden />}
          <div className="tlb-sheet">
            <div className="tlb-mats">
              <Surface material="solid" radius={18} className="tlb-mat"><b>Solid</b><p>Static controls and dense content. Fully legible on any backdrop.</p></Surface>
              <Surface material="frost" radius={18} className="tlb-mat"><b>Frost</b><p>Small portalled overlays. Separates from content without smearing it.</p></Surface>
              <Surface material="lens" radius={18} lensThickness={1.4} className="tlb-mat tlb-mat--lens"><b>Lens</b><p>Floating and moving controls. Genuine refraction over textured content.</p></Surface>
            </div>
            <div className="tlb-live">
              <label className="tlb-live-item"><span className="tlb-live-lab">Segmented</span><Segmented value={seg} onChange={setSeg} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} /></label>
              <label className="tlb-live-item"><span className="tlb-live-lab">Tabs</span><Tabs value={tab} onChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "timeline", label: "Timeline" }, { value: "documents", label: "Documents" }]} /></label>
              <label className="tlb-live-item tlb-live-item--grow"><span className="tlb-live-lab">Slider — drag to see solid → refractive → solid</span><Slider value={sv} onChange={setSV} /></label>
            </div>
            <div className="tlb-dockslot"><FloatingDock /></div>
          </div>
        </div>
      </EnvCtx.Provider>
    </div>
  );
}

export const BENCH_CSS = `
.tlb{ display:flex; flex-direction:column; gap:14px; width:100%; }
.tlb-bar{ display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:12px 14px; border-radius:14px; background:var(--lg-fill); border:1px solid var(--lg-line-2); }
.tlb-group{ display:flex; flex-direction:column; gap:6px; } .tlb-group--grow{ margin-left:auto; }
.tlb-lab{ font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--lg-ink-3); }
.tlb-chips{ display:inline-flex; gap:4px; background:rgba(0,0,0,.18); border:1px solid var(--lg-line); border-radius:10px; padding:3px; } .lg-ds[data-theme="light"] .tlb-chips{ background:rgba(12,16,28,.05); }
.tlb-chip{ padding:5px 10px; border-radius:7px; background:none; border:none; font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-3); cursor:pointer; text-transform:capitalize; transition:background .15s,color .15s; } .tlb-chip:hover{ color:var(--lg-ink); } .tlb-chip[data-on]{ background:var(--lg-accent); color:#fff; } .tlb-chip:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tlb-toggles{ display:flex; gap:14px; flex-wrap:wrap; }
.tlb-toggle{ display:inline-flex; align-items:center; gap:8px; background:none; border:none; cursor:pointer; font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-2); padding:0; } .tlb-toggle:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; border-radius:6px; }
.tlb-toggle-track{ width:34px; height:20px; border-radius:999px; background:rgba(120,120,128,.4); position:relative; transition:background .25s; } .tlb-toggle[data-on] .tlb-toggle-track{ background:var(--lg-accent); }
.tlb-toggle-knob{ position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .25s cubic-bezier(.3,1.3,.4,1); } .tlb-toggle[data-on] .tlb-toggle-knob{ transform:translateX(14px); }
.tlb-fps{ font-size:11.5px; font-weight:700; color:var(--lg-ink-2); background:rgba(0,0,0,.2); border:1px solid var(--lg-line); border-radius:8px; padding:5px 9px; font-variant-numeric:tabular-nums; } .lg-ds[data-theme="light"] .tlb-fps{ background:rgba(12,16,28,.05); }

.tlb-stage{ position:relative; overflow:hidden; border-radius:18px; border:1px solid var(--lg-line-2); min-height:430px; padding:26px; display:flex; flex-direction:column; gap:22px; }
.tlb-stage--compact{ padding:16px; gap:14px; min-height:380px; }
.tlb-bd--gradient{ background:linear-gradient(120deg,#ff6b4a,#38bdf8 54%,#a878ff); }
.tlb-bd--bands{ background:repeating-linear-gradient(90deg,#ff6b4a 0 44px,#10203c 44px 88px,#38bdf8 88px 132px,#1b2a4a 132px 176px,#a878ff 176px 220px); }
.tlb-bd--photo{ background:radial-gradient(62% 80% at 18% 8%, #ffd79e, transparent 58%), radial-gradient(52% 64% at 82% 16%, #7bd0ff, transparent 60%), radial-gradient(80% 72% at 64% 96%, #2f7d5a, transparent 56%), linear-gradient(162deg,#1b2a44,#0d1726); }
.tlb-bd--text, .tlb-bd--grid{ background:#121a2e; } .lg-ds[data-theme="light"] .tlb-bd--text, .lg-ds[data-theme="light"] .tlb-bd--grid{ background:#eef1f7; }
.tlb-textlayer{ position:absolute; inset:0; padding:18px; font-size:19px; font-weight:800; line-height:1.28; letter-spacing:-.01em; color:rgba(255,255,255,.26); word-spacing:2px; overflow:hidden; user-select:none; } .lg-ds[data-theme="light"] .tlb-textlayer{ color:rgba(12,22,45,.3); }
.tlb-gridlayer{ position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.22) 1px, transparent 1px); background-size:26px 26px; } .lg-ds[data-theme="light"] .tlb-gridlayer{ background-image:linear-gradient(rgba(12,22,45,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(12,22,45,.16) 1px, transparent 1px); }

.tlb-sheet{ position:relative; z-index:1; display:flex; flex-direction:column; gap:22px; }
.tlb-stage--compact .tlb-sheet{ gap:14px; }
.tlb-mats{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; } @media (max-width:760px){ .tlb-mats{ grid-template-columns:1fr; } }
.tlb-mat{ padding:16px; color:var(--lg-ink); } .tlb-mat b{ display:block; font-size:13.5px; font-weight:750; margin-bottom:5px; } .tlb-mat p{ font-size:12px; color:var(--lg-ink-2); line-height:1.45; }
.tlb-mat--lens{ color:#fff; } .tlb-mat--lens b{ color:#fff; } .tlb-mat--lens p{ color:rgba(255,255,255,.86); }
.tlb-live{ display:flex; align-items:flex-end; gap:22px; flex-wrap:wrap; }
.tlb-live-item{ display:flex; flex-direction:column; gap:8px; } .tlb-live-item--grow{ flex:1; min-width:260px; }
.tlb-live-lab{ font-size:11px; font-weight:700; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); } .lg-ds[data-theme="light"] .tlb-bd--text .tlb-live-lab, .lg-ds[data-theme="light"] .tlb-bd--grid .tlb-live-lab{ color:var(--lg-ink); text-shadow:none; }
.tlb-dockslot{ display:flex; justify-content:center; }
`;
