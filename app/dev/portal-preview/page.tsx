"use client";

// /dev/portal-preview — the real portal (reused PortalOverviewHero + cards +
// ambient) with the chosen navs (T8 expandable corner + B5 magnify dock). TWO
// phones side by side: the LEFT runs the real refraction engine (desktop
// Chromium) so you can tune the lens; the RIGHT runs the frosted fallback that
// phones actually get. Each keeps its own settings + sliders. Scratch only.

import "@/app/styles/glass.css";
import { useEffect, useState, type CSSProperties } from "react";
import { PortalReadOnlyProvider } from "@/components/portal/PortalReadOnlyProvider";
import { PreviewProvider, type PreviewSettings, type ActiveStyle } from "./_parts/glass";
import { TopCornerNav, MagnifyDock, ACTIVE_STYLES, type ScreenKey } from "./_parts/navs";
import { OverviewScreen, ProgressScreen, UpdatesScreen } from "./_parts/screens";
import { PPV_CSS } from "./_parts/styles";

// Per-phone defaults (the settings in the two reference shots).
const REFR_DEFAULT: PreviewSettings = { theme: "light", frosted: false, accent: "#FF6B4A", active: "underline", blur: 48, opacity: 0.94, saturate: 260, shadow: 0.6, edge: 0.65, grain: 0.9, displace: 48, aberration: 1 };
const FALL_DEFAULT: PreviewSettings = { theme: "light", frosted: true, accent: "#FF6B4A", active: "underline", blur: 2, opacity: 0.7, saturate: 155, shadow: 0.6, edge: 0.65, grain: 0.42, displace: 0, aberration: 0 };

function glassVars(s: PreviewSettings): CSSProperties {
  const dark = s.theme === "dark";
  const tint = dark ? `rgba(26,32,41,${s.opacity})` : `rgba(255,247,243,${s.opacity})`;
  const edge = `rgba(255,255,255,${s.edge})`;
  const edgeHi = `rgba(255,255,255,${(dark ? s.edge * 0.2 : s.edge * 0.9).toFixed(2)})`;
  const sh = s.shadow;
  const shadow = `0 ${Math.round(6 + sh * 18)}px ${Math.round(16 + sh * 26)}px rgba(255,138,101,${(0.05 + sh * 0.16).toFixed(2)}), 0 2px 10px rgba(15,23,42,${(0.04 + sh * 0.1).toFixed(2)})`;
  return {
    "--ppv-tint": tint,
    "--ppv-blur": `${s.blur}px`,
    "--ppv-sat": `${s.saturate}%`,
    "--ppv-edge": edge,
    "--ppv-edge-hi": edgeHi,
    "--ppv-shadow": shadow,
    "--ppv-grain": String(s.grain),
  } as CSSProperties;
}

function Slider({ label, min, max, step, value, onChange, fmt }: { label: string; min: number; max: number; step: number; value: number; onChange: (n: number) => void; fmt?: (n: number) => string }) {
  return (
    <label className="ppv-slider">
      <span className="ppv-slider-top"><span>{label}</span><span className="ppv-slider-val">{fmt ? fmt(value) : value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

function GlassControls({ title, mode, s, set, onReset }: { title: string; mode: "refraction" | "fallback"; s: PreviewSettings; set: (p: Partial<PreviewSettings>) => void; onReset: () => void }) {
  return (
    <div className="ppv-sliders">
      <div className="ppv-sliders-head"><span className="ppv-ctl-lbl">{title}</span><button type="button" className="ppv-reset" onClick={onReset}>Reset</button></div>
      <Slider label="Blur" min={0} max={60} step={1} value={s.blur} onChange={(blur) => set({ blur })} />
      <Slider label="Opacity" min={0.2} max={0.98} step={0.02} value={s.opacity} onChange={(opacity) => set({ opacity })} fmt={(n) => n.toFixed(2)} />
      <Slider label="Saturation" min={100} max={280} step={5} value={s.saturate} onChange={(saturate) => set({ saturate })} fmt={(n) => `${n}%`} />
      <Slider label="Shadow" min={0} max={1} step={0.05} value={s.shadow} onChange={(shadow) => set({ shadow })} fmt={(n) => n.toFixed(2)} />
      <Slider label="Edge" min={0} max={1} step={0.05} value={s.edge} onChange={(edge) => set({ edge })} fmt={(n) => n.toFixed(2)} />
      {mode === "refraction" ? (
        <>
          <Slider label="Rim bend" min={0} max={120} step={2} value={s.displace} onChange={(displace) => set({ displace })} />
          <Slider label="Chromatic" min={0} max={10} step={1} value={s.aberration} onChange={(aberration) => set({ aberration })} />
        </>
      ) : (
        <Slider label="Grain" min={0} max={0.9} step={0.03} value={s.grain} onChange={(grain) => set({ grain })} fmt={(n) => n.toFixed(2)} />
      )}
    </div>
  );
}

function Phone({ settings, screen, setScreen }: { settings: PreviewSettings; screen: ScreenKey; setScreen: (k: ScreenKey) => void }) {
  return (
    <div className="ppv-phone" data-theme={settings.theme} style={glassVars(settings)}>
      <div className="ppv-notch" />
      <div className="ppv-ambient" />
      <PreviewProvider value={settings}>
        <PortalReadOnlyProvider readOnly>
          <div className="ppv-screen-scroll portal-scope">
            {screen === "overview" && <OverviewScreen />}
            {screen === "progress" && <ProgressScreen />}
            {screen === "updates" && <UpdatesScreen />}
          </div>
          <div className="ppv-top-layer"><TopCornerNav /></div>
          <div className="ppv-bottom-layer"><MagnifyDock active={screen} setActive={setScreen} /></div>
        </PortalReadOnlyProvider>
      </PreviewProvider>
    </div>
  );
}

export default function PortalPreviewPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [refr, setRefr] = useState<PreviewSettings>(REFR_DEFAULT);
  const [fall, setFall] = useState<PreviewSettings>(FALL_DEFAULT);
  const [screen, setScreen] = useState<ScreenKey>("overview");
  const [activeStyle, setActiveStyle] = useState<ActiveStyle>("underline");
  const setRefrP = (p: Partial<PreviewSettings>) => setRefr((prev) => ({ ...prev, ...p }));
  const setFallP = (p: Partial<PreviewSettings>) => setFall((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-portal-theme");
    el.setAttribute("data-portal-theme", theme);
    return () => { if (prev) el.setAttribute("data-portal-theme", prev); else el.removeAttribute("data-portal-theme"); };
  }, [theme]);

  const refrS: PreviewSettings = { ...refr, theme, frosted: false, active: activeStyle };
  const fallS: PreviewSettings = { ...fall, theme, frosted: true, active: activeStyle };

  return (
    <div className="ppv-root" data-theme={theme} style={{ "--ppv-accent": "#FF6B4A" } as CSSProperties}>
      <div className="ppv-wrap">
        <header className="ppv-header">
          <h1 className="ppv-h1">Portal preview</h1>
          <p className="ppv-sub">The real portal with the chosen navigation (<b>T8 expandable corner</b> + <b>B5 magnify dock</b>). Left is the <b>refraction</b> lens (desktop Chromium) to tune; right is the <b>frosted fallback</b> phones actually get. Each has its own sliders. Use either dock to switch screens.</p>
        </header>

        <div className="ppv-controls">
          <div className="ppv-ctl">
            <span className="ppv-ctl-lbl">Theme (both)</span>
            <div className="ppv-switch">
              <button type="button" data-on={theme === "light" ? "1" : undefined} onClick={() => setTheme("light")}>Light</button>
              <button type="button" data-on={theme === "dark" ? "1" : undefined} onClick={() => setTheme("dark")}>Dark</button>
            </div>
          </div>
          <div className="ppv-ctl ppv-ctl--wrap">
            <span className="ppv-ctl-lbl">You&rsquo;re here</span>
            <div className="ppv-chips">
              {ACTIVE_STYLES.map((a) => (
                <button key={a.id} type="button" className="ppv-chip" data-on={activeStyle === a.id ? "1" : undefined} onClick={() => setActiveStyle(a.id)}>{a.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="ppv-stage">
          <div className="ppv-col">
            <p className="ppv-col-title">Refraction <span>desktop Chromium</span></p>
            <Phone settings={refrS} screen={screen} setScreen={setScreen} />
            <GlassControls title="Refraction tuning" mode="refraction" s={refr} set={setRefrP} onReset={() => setRefr(REFR_DEFAULT)} />
          </div>
          <div className="ppv-col">
            <p className="ppv-col-title">Fallback <span>phones</span></p>
            <Phone settings={fallS} screen={screen} setScreen={setScreen} />
            <GlassControls title="Fallback tuning" mode="fallback" s={fall} set={setFallP} onReset={() => setFall(FALL_DEFAULT)} />
          </div>
        </div>
      </div>
      <style>{PPV_CSS}</style>
    </div>
  );
}
