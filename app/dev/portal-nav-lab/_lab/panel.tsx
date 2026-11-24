"use client";

// The laboratory chrome: experiment controls, a categorised concept gallery with
// favourites + side-by-side comparison, and combined top+bottom presets. Gallery
// previews force the cheap frosted material (advanced off) so dozens render
// without jank; only the big phone + the compare strip use real refraction.

import { type ReactNode } from "react";
import {
  SettingsProvider,
  ACCENTS,
  BACKGROUNDS,
  HIDE_MODES,
  type Settings,
  type TabKey,
  type BgMode,
  type HideMode,
} from "./kit";
import { TOP_VARIANTS } from "./top";
import { BOTTOM_VARIANTS } from "./bottom";

// ── small inputs ────────────────────────────────────────────────────────────────
function Slider({ label, min, max, step, value, onChange, fmt }: { label: string; min: number; max: number; step: number; value: number; onChange: (n: number) => void; fmt?: (n: number) => string }) {
  return (
    <label className="pnl-slider">
      <span className="pnl-slider-top"><span>{label}</span><span className="pnl-slider-val">{fmt ? fmt(value) : value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pnl-chips">
      {options.map((o) => (
        <button key={o.id} type="button" className="pnl-chip" data-on={value === o.id ? "1" : undefined} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

// ── controls ─────────────────────────────────────────────────────────────────────
export function Controls({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  return (
    <div className="pnl-controls">
      <div className="pnl-ctl-row">
        <div className="pnl-ctl">
          <span className="pnl-ctl-lbl">Theme</span>
          <div className="pnl-switch">
            <button type="button" data-on={s.theme === "light" ? "1" : undefined} onClick={() => set({ theme: "light" })}>Light</button>
            <button type="button" data-on={s.theme === "dark" ? "1" : undefined} onClick={() => set({ theme: "dark" })}>Dark</button>
          </div>
        </div>
        <div className="pnl-ctl">
          <span className="pnl-ctl-lbl">Accent</span>
          <div className="pnl-swatches">
            {ACCENTS.map((a) => (
              <button key={a.id} type="button" className="pnl-swatch" data-on={s.accent === a.value ? "1" : undefined} style={{ background: a.value }} onClick={() => set({ accent: a.value })} aria-label={a.label} />
            ))}
          </div>
        </div>
        <div className="pnl-ctl">
          <span className="pnl-ctl-lbl">Advanced glass</span>
          <label className="pnl-check">
            <input type="checkbox" checked={s.advanced} onChange={(e) => set({ advanced: e.target.checked })} />
            Real refraction (Chromium)
          </label>
        </div>
      </div>

      <div className="pnl-ctl-block">
        <span className="pnl-ctl-lbl">Background to test over</span>
        <Chips<BgMode> options={BACKGROUNDS} value={s.bg} onChange={(bg) => set({ bg })} />
      </div>

      <div className="pnl-ctl-block">
        <span className="pnl-ctl-lbl">Bottom hide behaviour</span>
        <Chips<HideMode> options={HIDE_MODES} value={s.hideMode} onChange={(hideMode) => set({ hideMode })} />
      </div>

      <div className="pnl-sliders">
        <Slider label="Blur" min={0} max={40} step={1} value={s.blur} onChange={(blur) => set({ blur })} fmt={(n) => `${n}px`} />
        <Slider label="Surface opacity" min={0.1} max={0.9} step={0.02} value={s.tint} onChange={(tint) => set({ tint })} fmt={(n) => n.toFixed(2)} />
        <Slider label="Refraction" min={0} max={120} step={2} value={s.displace} onChange={(displace) => set({ displace })} />
        <Slider label="Chromatic edge" min={0} max={12} step={1} value={s.aberration} onChange={(aberration) => set({ aberration })} fmt={(n) => `${n}px`} />
        <Slider label="Shadow depth" min={0} max={1} step={0.05} value={s.shadow} onChange={(shadow) => set({ shadow })} fmt={(n) => n.toFixed(2)} />
        <Slider label="Corner radius" min={8} max={34} step={1} value={s.radius} onChange={(radius) => set({ radius })} fmt={(n) => `${n}px`} />
        <Slider label="Nav size" min={0.85} max={1.18} step={0.01} value={s.size} onChange={(size) => set({ size })} fmt={(n) => `${Math.round(n * 100)}%`} />
        <Slider label="Edge distance" min={0} max={40} step={1} value={s.edgeGap} onChange={(edgeGap) => set({ edgeGap })} fmt={(n) => `${n}px`} />
        <Slider label="Spring response" min={0.18} max={0.8} step={0.02} value={s.response} onChange={(response) => set({ response })} fmt={(n) => `${n.toFixed(2)}s`} />
        <Slider label="Spring bounce" min={0} max={0.7} step={0.02} value={s.bounce} onChange={(bounce) => set({ bounce })} fmt={(n) => n.toFixed(2)} />
      </div>
    </div>
  );
}

// ── gallery tile ───────────────────────────────────────────────────────────────
function stop(fn: () => void) {
  return (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
}

function Tile({ id, name, note, kind, on, onSelect, fav, onFav, cmp, onCmp, children }: {
  id: string; name: string; note: string; kind: "top" | "bottom";
  on: boolean; onSelect: () => void; fav: boolean; onFav: () => void;
  cmp?: boolean; onCmp?: () => void; children: ReactNode;
}) {
  return (
    <div className={`pnl-tile${on ? " on" : ""}`} role="button" tabIndex={0} onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}>
      <div className={`pnl-tile-stage pnl-tile-stage--${kind}`}>
        <div className="pnl-tile-bg" />
        <div className={`pnl-tile-scale pnl-tile-scale--${kind}`}>{children}</div>
      </div>
      <div className="pnl-tile-meta">
        <span className="pnl-tile-name"><b>{id}</b> {name}</span>
        <span className="pnl-tile-acts">
          {onCmp && <button type="button" className={`pnl-tile-act${cmp ? " on" : ""}`} onClick={stop(onCmp)} title="Add to comparison" aria-label="Add to comparison">⇄</button>}
          <button type="button" className={`pnl-tile-act${fav ? " on" : ""}`} onClick={stop(onFav)} title="Favourite" aria-label="Favourite">{fav ? "★" : "☆"}</button>
        </span>
      </div>
      <p className="pnl-tile-note">{note}</p>
    </div>
  );
}

// ── gallery ───────────────────────────────────────────────────────────────────────
export function Gallery({ s, topId, bottomId, setTopId, setBottomId, active, setActive, favs, toggleFav, compare, toggleCompare, favOnly }: {
  s: Settings;
  topId: string; bottomId: string;
  setTopId: (id: string) => void; setBottomId: (id: string) => void;
  active: TabKey; setActive: (k: TabKey) => void;
  favs: Set<string>; toggleFav: (id: string) => void;
  compare: string[]; toggleCompare: (id: string) => void;
  favOnly: boolean;
}) {
  // Previews are cheap frosted glass regardless of the live advanced toggle.
  const previewSettings: Settings = { ...s, advanced: false, bg: "gradient" };
  const tops = favOnly ? TOP_VARIANTS.filter((v) => favs.has(v.id)) : TOP_VARIANTS;
  const bottoms = favOnly ? BOTTOM_VARIANTS.filter((v) => favs.has(v.id)) : BOTTOM_VARIANTS;

  return (
    <SettingsProvider value={previewSettings}>
      <div className="pnl-gallery">
        <div className="pnl-gal-group">
          <p className="pnl-gal-title">Top navigation <span>{tops.length}</span></p>
          <div className="pnl-grid">
            {tops.map((v) => (
              <Tile key={v.id} id={v.id} name={v.name} note={v.note} kind="top" on={v.id === topId} onSelect={() => setTopId(v.id)}
                fav={favs.has(v.id)} onFav={() => toggleFav(v.id)}>
                {v.render({ scroll: 0, mini: true })}
              </Tile>
            ))}
          </div>
        </div>
        <div className="pnl-gal-group">
          <p className="pnl-gal-title">Bottom navigation <span>{bottoms.length}</span></p>
          <div className="pnl-grid">
            {bottoms.map((v) => (
              <Tile key={v.id} id={v.id} name={v.name} note={v.note} kind="bottom" on={v.id === bottomId} onSelect={() => setBottomId(v.id)}
                fav={favs.has(v.id)} onFav={() => toggleFav(v.id)} cmp={compare.includes(v.id)} onCmp={() => toggleCompare(v.id)}>
                {v.render({ active, setActive, down: false, scroll: 0, mini: true })}
              </Tile>
            ))}
          </div>
        </div>
      </div>
    </SettingsProvider>
  );
}

// ── comparison strip (bottom navs, real glass, shared settings) ──────────────────
export function Compare({ s, ids, active, setActive, clear }: { s: Settings; ids: string[]; active: TabKey; setActive: (k: TabKey) => void; clear: () => void }) {
  if (ids.length === 0) return null;
  const picked = BOTTOM_VARIANTS.filter((v) => ids.includes(v.id));
  return (
    <div className="pnl-compare">
      <div className="pnl-compare-head">
        <p className="pnl-gal-title">Comparison <span>{picked.length}</span></p>
        <button type="button" className="pnl-clear" onClick={clear}>Clear</button>
      </div>
      <div className="pnl-compare-row">
        {picked.map((v) => (
          <SettingsProvider key={v.id} value={s}>
            <div className="pnl-compare-cell">
              <div className="pnl-compare-stage" data-theme={s.theme} data-bg={s.bg}>
                <div className="pnl-hero pnl-hero--mini"><div className="pnl-hero-art" /></div>
                <div className="pnl-compare-nav">{v.render({ active, setActive, down: false, scroll: 0, mini: false })}</div>
              </div>
              <p className="pnl-tile-note"><b>{v.id}</b> {v.name}</p>
            </div>
          </SettingsProvider>
        ))}
      </div>
    </div>
  );
}

// ── combined systems ───────────────────────────────────────────────────────────
const COMBOS: { name: string; top: string; bottom: string; hide: HideMode; note: string }[] = [
  { name: "Quietly native", top: "T1", bottom: "B1", hide: "hideDown", note: "Floating island + floating dock." },
  { name: "Playful liquid", top: "T4", bottom: "B8", hide: "hideDown", note: "Dynamic island + liquid selector." },
  { name: "Minimal", top: "T6", bottom: "B11", hide: "fade", note: "Glass ribbon + icon-only pill." },
  { name: "Spatial depth", top: "T11", bottom: "B3", hide: "shrink", note: "VisionOS layered + three bubbles." },
  { name: "Content-first", top: "T7", bottom: "B6", hide: "hideDown", note: "Morphing menu + collapse-to-orb." },
  { name: "Confident capsule", top: "T2", bottom: "B4", hide: "slideUnder", note: "Liquid capsule + magnetic capsule." },
];

export function Combined({ apply, topId, bottomId }: { apply: (c: { top: string; bottom: string; hide: HideMode }) => void; topId: string; bottomId: string }) {
  return (
    <div className="pnl-combos">
      <p className="pnl-gal-title">Combined systems</p>
      <div className="pnl-combo-row">
        {COMBOS.map((c) => {
          const on = c.top === topId && c.bottom === bottomId;
          return (
            <button key={c.name} type="button" className={`pnl-combo${on ? " on" : ""}`} onClick={() => apply(c)}>
              <span className="pnl-combo-name">{c.name}</span>
              <span className="pnl-combo-ids">{c.top} + {c.bottom}</span>
              <span className="pnl-combo-note">{c.note}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
