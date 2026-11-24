"use client";

// Bottom-navigation concepts — the heart of the lab. Each is a genuinely
// different navigation experience (geometry, motion, selection physics), not a
// restyle. Spring-driven variants use the shared spring hook; all sit on the
// real/frosted GlassSurface.

import { useState, type ReactNode } from "react";
import { List, X } from "@phosphor-icons/react";
import { GlassSurface, useSettings, useSpringValue, Unread, TABS, type TabKey } from "./kit";
import { Press } from "./physics";

export type BottomCtx = {
  active: TabKey;
  setActive: (k: TabKey) => void;
  down: boolean; // fully retracted (self-morphing variants react to this)
  scroll: number;
  mini?: boolean; // gallery preview — keep cheap + non-interactive
};
export type BottomVariant = { id: string; name: string; note: string; render: (ctx: BottomCtx) => ReactNode };

const idxOf = (k: TabKey) => TABS.findIndex((t) => t.key === k);

// A vertical icon + label cell (the common tab body).
function Cell({ tab, on, accent, children }: { tab: (typeof TABS)[number]; on: boolean; accent: string; children?: ReactNode }) {
  const { Icon } = tab;
  return (
    <>
      <span className="pnl-b-ico"><Icon size={21} weight={on ? "fill" : "regular"} style={on ? { color: accent } : undefined} />{tab.badge ? <Unread n={tab.badge} /> : null}</span>
      <span className="pnl-b-lbl" style={on ? { color: accent } : undefined}>{tab.label}</span>
      {children}
    </>
  );
}

// 1 — Floating dock: icon + label, active tinted. The familiar reference.
function BDock({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <GlassSurface radius={26} className="pnl-b-pill" badge>
      {TABS.map((t) => (
        <Press key={t.key} className="pnl-b-tab" onClick={() => setActive(t.key)} squash={0.9}>
          <Cell tab={t} on={t.key === active} accent={s.accent} />
        </Press>
      ))}
    </GlassSurface>
  );
}

// 2 — Liquid segmented: a glass segment with a spring-sliding tinted indicator.
function BSegmented({ active, setActive }: BottomCtx) {
  const s = useSettings();
  const ai = useSpringValue(idxOf(active));
  return (
    <GlassSurface radius={24} className="pnl-b-seg" badge>
      <span className="pnl-b-seg-ind" style={{ transform: `translateX(${ai * 100}%)`, background: s.accent, opacity: 0.16 }} />
      {TABS.map((t) => (
        <button key={t.key} type="button" className="pnl-b-seg-tab" onClick={() => setActive(t.key)}>
          <Cell tab={t} on={t.key === active} accent={s.accent} />
        </button>
      ))}
    </GlassSurface>
  );
}

// 3 — Three independent bubbles: each tab its own floating glass disc.
function BBubbles({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <div className="pnl-b-bubbles">
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <GlassSurface key={t.key} radius={999} className={`pnl-b-bubble${on ? " on" : ""}`} badge={false} style={on ? { boxShadow: `0 10px 26px ${s.accent}55` } : undefined}>
            <Press className="pnl-b-bubble-btn" onClick={() => setActive(t.key)} label={t.label}>
              <Icon size={on ? 22 : 20} weight={on ? "fill" : "regular"} style={on ? { color: s.accent } : undefined} />{t.badge ? <Unread n={t.badge} /> : null}
            </Press>
          </GlassSurface>
        );
      })}
    </div>
  );
}

// 4 — Magnetic capsule: inactive are icons; the active tab expands into a label.
function BMagnet({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <GlassSurface radius={26} className="pnl-b-pill pnl-b-pill--tight" badge>
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <button key={t.key} type="button" className={`pnl-b-mag${on ? " on" : ""}`} onClick={() => setActive(t.key)} style={on ? { background: s.accent } : undefined}>
            <span className="pnl-b-ico"><Icon size={20} weight={on ? "fill" : "regular"} />{t.badge && !on ? <Unread n={t.badge} /> : null}</span>
            {on && <span className="pnl-b-mag-lbl">{t.label}</span>}
          </button>
        );
      })}
    </GlassSurface>
  );
}

// 5 — Magnification dock: the active item scales up, neighbours ease down.
function BMagnify({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <GlassSurface radius={26} className="pnl-b-pill" badge>
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <button key={t.key} type="button" className="pnl-b-mgfy" onClick={() => setActive(t.key)} style={{ transform: `scale(${on ? 1.18 : 0.92})` }}>
            <span className="pnl-b-ico"><Icon size={22} weight={on ? "fill" : "regular"} style={on ? { color: s.accent } : undefined} />{t.badge ? <Unread n={t.badge} /> : null}</span>
          </button>
        );
      })}
    </GlassSurface>
  );
}

// 6 — Collapse to orb: when retracted it is a single bubble; tap to fan out.
function BOrb({ active, setActive, down }: BottomCtx) {
  const [forceOpen, setForceOpen] = useState(false);
  const open = !down || forceOpen;
  const t = useSpringValue(open ? 1 : 0, 0.5, 0.34);
  const s = useSettings();
  const ActiveIcon = (TABS.find((x) => x.key === active) ?? TABS[0]).Icon;
  return (
    <div className="pnl-b-orb-wrap">
      <span className="pnl-b-orb-row" style={{ width: t * 212, opacity: t, pointerEvents: open ? "auto" : "none" }}>
        <GlassSurface radius={26} className="pnl-b-pill" badge={false}>
          {TABS.map((tb) => (
            <button key={tb.key} type="button" className="pnl-b-tab" onClick={() => setActive(tb.key)}>
              <Cell tab={tb} on={tb.key === active} accent={s.accent} />
            </button>
          ))}
        </GlassSurface>
      </span>
      {!open && (
        <GlassSurface radius={999} className="pnl-b-orb" badge>
          <Press className="pnl-b-orb-btn" onClick={() => setForceOpen(true)} label="Open navigation"><ActiveIcon size={24} weight="fill" style={{ color: s.accent }} /></Press>
        </GlassSurface>
      )}
    </div>
  );
}

// 7 — Compress to handle: retracts into a thin glass grab-handle; tap to restore.
function BHandle({ active, setActive, down }: BottomCtx) {
  const [open, setOpen] = useState(false);
  const shown = !down || open;
  const t = useSpringValue(shown ? 1 : 0, 0.46, 0.3);
  const s = useSettings();
  return (
    <div className="pnl-b-handle-wrap">
      {shown ? (
        <span style={{ transform: `scale(${t})`, opacity: t, display: "block" }}>
          <GlassSurface radius={26} className="pnl-b-pill" badge>
            {TABS.map((tb) => (
              <button key={tb.key} type="button" className="pnl-b-tab" onClick={() => { setActive(tb.key); }}>
                <Cell tab={tb} on={tb.key === active} accent={s.accent} />
              </button>
            ))}
          </GlassSurface>
        </span>
      ) : (
        <GlassSurface radius={999} className="pnl-b-handle" badge>
          <button type="button" className="pnl-b-handle-btn" onClick={() => setOpen(true)} aria-label="Show navigation"><span /></button>
        </GlassSurface>
      )}
    </div>
  );
}

// 8 — Liquid selector: a tinted glass blob slides and stretches between icons.
function BLiquid({ active, setActive }: BottomCtx) {
  const s = useSettings();
  const target = idxOf(active);
  const ai = useSpringValue(target);
  const stretch = 1 + Math.min(0.5, Math.abs(target - ai) * 0.9);
  return (
    <GlassSurface radius={26} className="pnl-b-pill pnl-b-pill--tight" badge>
      <span className="pnl-b-liquid-blob" style={{ transform: `translateX(${ai * 100}%) scaleX(${stretch})`, background: s.accent }} />
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <button key={t.key} type="button" className="pnl-b-liquid-tab" onClick={() => setActive(t.key)}>
            <Icon size={21} weight={on ? "fill" : "regular"} style={on ? { color: "#fff" } : undefined} />{t.badge ? <Unread n={t.badge} /> : null}
          </button>
        );
      })}
    </GlassSurface>
  );
}

// 9 — Stretching indicator: a slim bar that elongates during the move, then settles.
function BStretch({ active, setActive }: BottomCtx) {
  const s = useSettings();
  const target = idxOf(active);
  const ai = useSpringValue(target);
  const stretch = 1 + Math.min(1.4, Math.abs(target - ai) * 2.2);
  return (
    <GlassSurface radius={24} className="pnl-b-pill" badge>
      <span className="pnl-b-stretch" style={{ transform: `translateX(${ai * 100}%) scaleX(${stretch})`, background: s.accent }} />
      {TABS.map((t) => (
        <button key={t.key} type="button" className="pnl-b-tab" onClick={() => setActive(t.key)}>
          <Cell tab={t} on={t.key === active} accent={s.accent} />
        </button>
      ))}
    </GlassSurface>
  );
}

// 10 — Emerge from surface: the selected tab rises out of the glass on a riser.
function BEmerge({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <GlassSurface radius={26} className="pnl-b-pill" badge>
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <button key={t.key} type="button" className="pnl-b-emerge" onClick={() => setActive(t.key)}>
            <span className={`pnl-b-emerge-ico${on ? " on" : ""}`} style={on ? { background: s.accent, boxShadow: `0 8px 18px ${s.accent}66` } : undefined}>
              <Icon size={20} weight={on ? "fill" : "regular"} style={on ? { color: "#fff" } : undefined} />{t.badge ? <Unread n={t.badge} /> : null}
            </span>
            <span className="pnl-b-lbl" style={on ? { color: s.accent } : undefined}>{t.label}</span>
          </button>
        );
      })}
    </GlassSurface>
  );
}

// 11 — Icon-only minimal: a small floating pill, active carries an accent dot.
function BIconOnly({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <GlassSurface radius={999} className="pnl-b-pill pnl-b-pill--mini" badge>
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <Press key={t.key} className="pnl-b-mini" onClick={() => setActive(t.key)} label={t.label}>
            <Icon size={22} weight={on ? "fill" : "regular"} style={on ? { color: s.accent } : undefined} />{t.badge ? <Unread n={t.badge} /> : null}
            <span className="pnl-b-mini-dot" style={on ? { background: s.accent } : undefined} />
          </Press>
        );
      })}
    </GlassSurface>
  );
}

// 12 — Raised centre: the real middle destination (Progress) lifted into a dock
// button, Overview and Updates either side. Still the three real tabs.
function BCentre({ active, setActive }: BottomCtx) {
  const s = useSettings();
  const [a, b, c] = TABS;
  const MidIcon = b.Icon;
  const midOn = b.key === active;
  return (
    <GlassSurface radius={30} className="pnl-b-pill pnl-b-centre" badge>
      <button type="button" className="pnl-b-tab" onClick={() => setActive(a.key)}><Cell tab={a} on={a.key === active} accent={s.accent} /></button>
      <div className="pnl-b-centre-mid">
        <Press className="pnl-b-fab" onClick={() => setActive(b.key)} label={b.label} style={{ background: midOn ? s.accent : "rgba(125,125,135,0.22)", color: midOn ? "#fff" : "var(--gink)" }}>
          <MidIcon size={22} weight={midOn ? "fill" : "regular"} />{b.badge ? <Unread n={b.badge} /> : null}
        </Press>
        <span className="pnl-b-centre-lbl" style={midOn ? { color: s.accent } : undefined}>{b.label}</span>
      </div>
      <button type="button" className="pnl-b-tab" onClick={() => setActive(c.key)}><Cell tab={c} on={c.key === active} accent={s.accent} /></button>
    </GlassSurface>
  );
}

// 13 — Radial menu: a single glass button that fans its destinations in an arc.
function BRadial({ active, setActive }: BottomCtx) {
  const [open, setOpen] = useState(false);
  const t = useSpringValue(open ? 1 : 0, 0.5, 0.4);
  const s = useSettings();
  const spots = [[-78, -34], [0, -58], [78, -34]];
  return (
    <div className="pnl-b-radial">
      {TABS.map((tb, i) => {
        const [dx, dy] = spots[i];
        const { Icon } = tb;
        const on = tb.key === active;
        return (
          <GlassSurface key={tb.key} radius={999} className="pnl-b-radial-item" badge={false}
            style={{ transform: `translate(${dx * t}px, ${dy * t}px) scale(${t})`, opacity: t, pointerEvents: open ? "auto" : "none" }}>
            <button type="button" className="pnl-b-radial-btn" onClick={() => { setActive(tb.key); setOpen(false); }} aria-label={tb.label}>
              <Icon size={19} weight={on ? "fill" : "regular"} style={on ? { color: s.accent } : undefined} />
            </button>
          </GlassSurface>
        );
      })}
      <GlassSurface radius={999} className="pnl-b-radial-core" badge>
        <Press className="pnl-b-radial-core-btn" onClick={() => setOpen((o) => !o)} label="Menu" style={{ background: open ? s.accent : undefined, color: open ? "#fff" : undefined }}>
          {open ? <X size={22} weight="bold" /> : <List size={22} />}
        </Press>
      </GlassSurface>
    </div>
  );
}

// 14 — Edge dock: docked flush to the bottom edge, rounded top corners only.
function BEdge({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <GlassSurface radius={0} className="pnl-b-edge" style={{ borderRadius: "26px 26px 0 0" }} badge>
      {TABS.map((t) => (
        <button key={t.key} type="button" className="pnl-b-tab pnl-b-tab--grow" onClick={() => setActive(t.key)}>
          <Cell tab={t} on={t.key === active} accent={s.accent} />
        </button>
      ))}
    </GlassSurface>
  );
}

// 15 — Gather: icons drift apart at rest and gather into a capsule on interaction.
function BGather({ active, setActive }: BottomCtx) {
  const [hover, setHover] = useState(false);
  const g = useSpringValue(hover ? 0 : 1, 0.5, 0.3); // 1 = spread, 0 = gathered
  const s = useSettings();
  const offs = [-1, 0, 1];
  return (
    <div className="pnl-b-gather" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onTouchStart={() => setHover(true)}>
      <GlassSurface radius={26} className="pnl-b-pill pnl-b-pill--tight" badge>
        {TABS.map((t, i) => {
          const on = t.key === active;
          const { Icon } = t;
          return (
            <button key={t.key} type="button" className="pnl-b-gather-tab" onClick={() => setActive(t.key)} style={{ transform: `translateX(${offs[i] * g * 18}px)` }}>
              <Icon size={21} weight={on ? "fill" : "regular"} style={on ? { color: s.accent } : undefined} />{t.badge ? <Unread n={t.badge} /> : null}
            </button>
          );
        })}
      </GlassSurface>
    </div>
  );
}

// 16 — Follow bubble: a minimal rail where a single glass bubble tracks the active.
function BFollow({ active, setActive }: BottomCtx) {
  const s = useSettings();
  const ai = useSpringValue(idxOf(active), 0.4, 0.4);
  return (
    <GlassSurface radius={999} className="pnl-b-follow" badge>
      <span className="pnl-b-follow-bubble" style={{ transform: `translateX(${ai * 100}%)`, background: s.accent }} />
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <button key={t.key} type="button" className="pnl-b-follow-tab" onClick={() => setActive(t.key)} aria-label={t.label}>
            <Icon size={20} weight={on ? "fill" : "regular"} style={{ color: on ? "#fff" : undefined }} />{t.badge ? <Unread n={t.badge} /> : null}
          </button>
        );
      })}
    </GlassSurface>
  );
}

// 17 — Control-centre tiles: rounded glass tiles, iOS Control-Centre flavour.
function BTiles({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <div className="pnl-b-tiles">
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <GlassSurface key={t.key} radius={18} className={`pnl-b-tile${on ? " on" : ""}`} badge={false} style={on ? { background: `${s.accent}26` } : undefined}>
            <button type="button" className="pnl-b-tile-btn" onClick={() => setActive(t.key)}>
              <Icon size={22} weight={on ? "fill" : "regular"} style={on ? { color: s.accent } : undefined} />{t.badge ? <Unread n={t.badge} /> : null}
              <span className="pnl-b-tile-lbl" style={on ? { color: s.accent } : undefined}>{t.label}</span>
            </button>
          </GlassSurface>
        );
      })}
    </div>
  );
}

// 18 — Watch dial: compact, Apple-Watch-flavoured round cluster.
function BWatch({ active, setActive }: BottomCtx) {
  const s = useSettings();
  return (
    <GlassSurface radius={999} className="pnl-b-watch" badge>
      {TABS.map((t) => {
        const on = t.key === active;
        const { Icon } = t;
        return (
          <Press key={t.key} className={`pnl-b-watch-tab${on ? " on" : ""}`} onClick={() => setActive(t.key)} label={t.label} style={on ? { background: s.accent, color: "#fff" } : undefined}>
            <Icon size={on ? 20 : 18} weight={on ? "fill" : "regular"} />{t.badge ? <Unread n={t.badge} /> : null}
          </Press>
        );
      })}
    </GlassSurface>
  );
}

export const BOTTOM_VARIANTS: BottomVariant[] = [
  { id: "B1", name: "Floating dock", note: "Icon + label, active tinted. The reference.", render: (c) => <BDock {...c} /> },
  { id: "B2", name: "Liquid segmented", note: "A spring-sliding tinted glass segment.", render: (c) => <BSegmented {...c} /> },
  { id: "B3", name: "Three bubbles", note: "Each destination its own floating disc.", render: (c) => <BBubbles {...c} /> },
  { id: "B4", name: "Magnetic capsule", note: "Icons until the active one expands a label.", render: (c) => <BMagnet {...c} /> },
  { id: "B5", name: "Magnify dock", note: "Active item scales up, neighbours ease down.", render: (c) => <BMagnify {...c} /> },
  { id: "B6", name: "Collapse to orb", note: "Retracts into one bubble; tap to fan out.", render: (c) => <BOrb {...c} /> },
  { id: "B7", name: "Compress to handle", note: "Retracts into a thin glass grab-handle.", render: (c) => <BHandle {...c} /> },
  { id: "B8", name: "Liquid selector", note: "A tinted blob slides and stretches between icons.", render: (c) => <BLiquid {...c} /> },
  { id: "B9", name: "Stretch indicator", note: "A bar that elongates during the move, then settles.", render: (c) => <BStretch {...c} /> },
  { id: "B10", name: "Emerge from surface", note: "The selected tab rises out of the glass.", render: (c) => <BEmerge {...c} /> },
  { id: "B11", name: "Icon-only minimal", note: "A small pill, active carries an accent dot.", render: (c) => <BIconOnly {...c} /> },
  { id: "B12", name: "Raised centre", note: "The middle destination lifted into a dock button.", render: (c) => <BCentre {...c} /> },
  { id: "B13", name: "Radial menu", note: "One button that fans destinations in an arc.", render: (c) => <BRadial {...c} /> },
  { id: "B14", name: "Edge dock", note: "Docked flush to the bottom edge.", render: (c) => <BEdge {...c} /> },
  { id: "B15", name: "Gather", note: "Icons drift apart at rest, gather on interaction.", render: (c) => <BGather {...c} /> },
  { id: "B16", name: "Follow bubble", note: "A single glass bubble tracks the active tab.", render: (c) => <BFollow {...c} /> },
  { id: "B17", name: "Control-centre tiles", note: "Rounded glass tiles, iOS Control-Centre flavour.", render: (c) => <BTiles {...c} /> },
  { id: "B18", name: "Watch dial", note: "Compact, Apple-Watch-flavoured cluster.", render: (c) => <BWatch {...c} /> },
];
