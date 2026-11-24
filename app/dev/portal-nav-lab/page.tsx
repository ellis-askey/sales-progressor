"use client";

// /dev/portal-nav-lab — an interaction-design laboratory for the buyer/seller
// portal navigation (critique #297). Explores liquid-glass top + bottom nav
// concepts with the real refraction engine, spring physics, hide/reveal, a
// background tester, comparison and favourites. Scratch only: imports existing
// in-house engines (components/quick-dock/LiquidGlass, components/liquid/lib/spring)
// and touches nothing in production. See _lab/* for the parts.

import { useState, type CSSProperties } from "react";
import { DEFAULT_SETTINGS, SettingsProvider, useChromium, type Settings, type TabKey, type HideMode } from "./_lab/kit";
import { TOP_VARIANTS } from "./_lab/top";
import { BOTTOM_VARIANTS } from "./_lab/bottom";
import { Phone } from "./_lab/stage";
import { Controls, Gallery, Compare, Combined } from "./_lab/panel";
import { LAB_CSS } from "./_lab/styles";

function rootStyle(s: Settings): CSSProperties {
  const dark = s.theme === "dark";
  const depth = s.shadow;
  const shadow = `0 ${Math.round(10 + depth * 18)}px ${Math.round(24 + depth * 28)}px rgba(${dark ? "0,0,0" : "16,18,30"},${(dark ? 0.3 : 0.12) + depth * 0.3})`;
  const edgeA = (dark ? 0.06 : 0.3) + s.edge * (dark ? 0.16 : 0.45);
  const edgeHiA = s.edge * (dark ? 0.12 : 0.5);
  return {
    "--pnl-accent": s.accent,
    "--pnl-blur": `${s.blur}px`,
    "--pnl-shadow": shadow,
    "--pnl-edge-color": `rgba(255,255,255,${edgeA})`,
    "--pnl-edge-hi": `rgba(255,255,255,${edgeHiA})`,
    "--pnl-radius": `${s.radius}px`,
  } as CSSProperties;
}

function SupportNote() {
  const ok = useChromium();
  return <span className="pnl-support" data-ok={ok ? "1" : undefined}>{ok ? "Real refraction active on this browser" : "Frosted fallback on this browser (refraction is Chromium only)"}</span>;
}

export default function PortalNavLabPage() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const set = (p: Partial<Settings>) => setS((prev) => ({ ...prev, ...p }));
  const [topId, setTopId] = useState("T2");
  const [bottomId, setBottomId] = useState("B1");
  const [active, setActive] = useState<TabKey>("overview");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState(false);

  const top = TOP_VARIANTS.find((v) => v.id === topId) ?? TOP_VARIANTS[0];
  const bottom = BOTTOM_VARIANTS.find((v) => v.id === bottomId) ?? BOTTOM_VARIANTS[0];

  const toggleFav = (id: string) => setFavs((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleCompare = (id: string) => setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev));
  const applyCombo = (c: { top: string; bottom: string; hide: HideMode }) => { setTopId(c.top); setBottomId(c.bottom); set({ hideMode: c.hide }); };

  return (
    <div className="pnl-root" data-theme={s.theme} style={rootStyle(s)}>
      <div className="pnl-wrap">
        <header className="pnl-header">
          <div>
            <h1 className="pnl-h1">Portal navigation lab</h1>
            <p className="pnl-h1-sub">Liquid-glass navigation for the buyer and seller portal. Pick a top and a bottom to combine them live, test over real backgrounds, and star the ones worth keeping. Scratch only, nothing ships. <SupportNote /></p>
          </div>
          <div className="pnl-header-right">
            <span className="pnl-combo-badge">{top.id} + {bottom.id}</span>
            <label className="pnl-favtoggle"><input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />Favourites only</label>
          </div>
        </header>

        <Controls s={s} set={set} />

        <div className="pnl-main">
          <div className="pnl-phone-col">
            <SettingsProvider value={s}>
              <Phone top={top} bottom={bottom} active={active} setActive={setActive} />
            </SettingsProvider>
          </div>
          <div className="pnl-right">
            <Combined apply={applyCombo} topId={topId} bottomId={bottomId} />
            <Gallery
              s={s}
              topId={topId} bottomId={bottomId}
              setTopId={setTopId} setBottomId={setBottomId}
              active={active} setActive={setActive}
              favs={favs} toggleFav={toggleFav}
              compare={compare} toggleCompare={toggleCompare}
              favOnly={favOnly}
            />
          </div>
        </div>

        <Compare s={s} ids={compare} active={active} setActive={setActive} clear={() => setCompare([])} />
      </div>
      <style>{LAB_CSS}</style>
    </div>
  );
}
