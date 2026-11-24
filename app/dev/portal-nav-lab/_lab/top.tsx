"use client";

// Top-navigation concepts. Each carries the REAL portal top-bar content — the
// time-of-day greeting ("Good evening, {name}") plus the menu (the hamburger that
// opens the Documents / Information / Settings / Customisation drawer). No
// address, no invented status: the variety is in geometry, attachment and motion,
// not the information. All sit on the shared GlassSurface.

import { useState, type ReactNode } from "react";
import { List, CaretDown, X } from "@phosphor-icons/react";
import { GlassSurface, useSettings, useSpringValue } from "./kit";
import { Press } from "./physics";

export type TopCtx = { scroll: number; mini?: boolean };
export type TopVariant = { id: string; name: string; note: string; render: (ctx: TopCtx) => ReactNode };

// What the real top bar actually holds.
const GREETING = "Good evening, Sam";
const SECTIONS = ["Documents", "Information", "Settings", "Customisation"];

function Menu({ onClick, size = 18 }: { onClick?: () => void; size?: number }) {
  return <Press className="pnl-t-ico" label="Open menu" onClick={onClick}><List size={size} weight="regular" /></Press>;
}
function Greet({ className = "pnl-t-greet" }: { className?: string }) {
  return <span className={className}>{GREETING}</span>;
}

// 1 — Floating island: a compact centred control, detached from the edge.
function TIsland() {
  return (
    <div className="pnl-t pnl-t--center">
      <GlassSurface radius={22} className="pnl-t-island" badge>
        <Greet className="pnl-t-island-txt" />
        <Menu size={17} />
      </GlassSurface>
    </div>
  );
}

// 2 — Liquid capsule: a wide translucent bar, greeting + menu. Closest to today.
function TCapsule() {
  return (
    <div className="pnl-t pnl-t--inset">
      <GlassSurface radius={20} className="pnl-t-capsule" badge>
        <Greet />
        <Menu />
      </GlassSurface>
    </div>
  );
}

// 3 — Twin bubbles: a greeting bubble + a menu bubble that magnetically ease together.
function TTwin() {
  const [near, setNear] = useState(false);
  const pull = useSpringValue(near ? 1 : 0, 0.5, 0.3);
  return (
    <div className="pnl-t pnl-t--spread" onMouseEnter={() => setNear(true)} onMouseLeave={() => setNear(false)}>
      <span style={{ transform: `translateX(${pull * 10}px)` }}>
        <GlassSurface radius={999} className="pnl-t-greet-bubble" badge={false}><Greet /></GlassSurface>
      </span>
      <span style={{ transform: `translateX(${pull * -10}px)` }}>
        <GlassSurface radius={999} className="pnl-t-round" badge={false}><Press className="pnl-t-round-btn" label="Open menu"><List size={18} /></Press></GlassSurface>
      </span>
    </div>
  );
}

// 4 — Dynamic island: a greeting pill that springs open to reveal the menu.
function TDynamic() {
  const [open, setOpen] = useState(false);
  const t = useSpringValue(open ? 1 : 0, 0.5, 0.34);
  return (
    <div className="pnl-t pnl-t--center">
      <GlassSurface radius={22} className="pnl-t-dyn" badge>
        <button type="button" className="pnl-t-dyn-core" onClick={() => setOpen((o) => !o)}>
          <Greet className="pnl-t-island-txt" />
          <CaretDown size={13} weight="bold" style={{ transform: `rotate(${t * 180}deg)`, opacity: 0.6 }} />
        </button>
        <span className="pnl-t-dyn-more" style={{ width: t * 184, opacity: t }}>
          <span className="pnl-t-sec">Documents</span>
          <span className="pnl-t-sec">Information</span>
        </span>
      </GlassSurface>
    </div>
  );
}

// 5 — Edge-mounted: greeting + menu hanging from the top edge (rounded bottom).
function TEdge() {
  return (
    <div className="pnl-t pnl-t--flush">
      <GlassSurface radius={0} className="pnl-t-edge" style={{ borderRadius: "0 0 24px 24px" }} badge>
        <Greet />
        <Menu />
      </GlassSurface>
    </div>
  );
}

// 6 — Glass ribbon: a thin, elegant floating strip with greeting + menu.
function TRibbon() {
  return (
    <div className="pnl-t pnl-t--inset">
      <GlassSurface radius={14} className="pnl-t-ribbon" badge>
        <span className="pnl-t-ribbon-txt">{GREETING}</span>
        <Menu size={15} />
      </GlassSurface>
    </div>
  );
}

// 7 — Morphing menu: the greeting morphs into the drawer's sections, led by the menu.
function TMorph() {
  const [open, setOpen] = useState(false);
  const t = useSpringValue(open ? 1 : 0, 0.46, 0.3);
  return (
    <div className="pnl-t pnl-t--center">
      <GlassSurface radius={20} className="pnl-t-morph" badge>
        <span className="pnl-t-morph-core" style={{ maxWidth: (1 - t) * 158, opacity: 1 - t }}>{GREETING}</span>
        <span className="pnl-t-morph-row" style={{ maxWidth: t * 230, opacity: t }}>
          {SECTIONS.map((sct) => <span key={sct} className="pnl-t-sec">{sct}</span>)}
        </span>
        <Press className="pnl-t-ico" label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>{open ? <X size={14} weight="bold" /> : <List size={16} />}</Press>
      </GlassSurface>
    </div>
  );
}

// 8 — Expandable corner: greeting kept, the menu fans the drawer sections down.
function TCorner() {
  const [open, setOpen] = useState(false);
  const t = useSpringValue(open ? 1 : 0, 0.5, 0.36);
  return (
    <div className="pnl-t pnl-t--spread">
      <GlassSurface radius={999} className="pnl-t-greet-bubble" badge={false}><Greet /></GlassSurface>
      <div className="pnl-t-corner">
        <GlassSurface radius={999} className="pnl-t-round" badge={false}>
          <Press className="pnl-t-round-btn" label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>{open ? <X size={17} weight="bold" /> : <List size={18} />}</Press>
        </GlassSurface>
        <span className="pnl-t-sec-stack" style={{ opacity: t, transform: `translateY(${(1 - t) * -8}px)`, pointerEvents: open ? "auto" : "none" }}>
          {SECTIONS.map((sct) => <span key={sct} className="pnl-t-sec">{sct}</span>)}
        </span>
      </div>
    </div>
  );
}

// 9 — Split pills: greeting and menu as two separate floating glass pieces.
function TSplit() {
  return (
    <div className="pnl-t pnl-t--spread">
      <GlassSurface radius={16} className="pnl-t-greet-bubble" badge><Greet /></GlassSurface>
      <GlassSurface radius={999} className="pnl-t-round" badge={false}><Press className="pnl-t-round-btn" label="Open menu"><List size={18} /></Press></GlassSurface>
    </div>
  );
}

// 10 — Scroll-reactive: greeting + menu expanded at the top, compresses on scroll.
function TScroll({ scroll }: TopCtx) {
  const k = Math.min(1, scroll);
  return (
    <div className="pnl-t pnl-t--inset">
      <GlassSurface radius={20 - k * 6} className="pnl-t-capsule" style={{ paddingTop: 11 - k * 4, paddingBottom: 11 - k * 4 }} badge>
        <span className="pnl-t-greet" style={{ fontSize: 14.5 - k * 2 }}>{k > 0.6 ? "Sam" : GREETING}</span>
        <Menu size={18 - k * 2} />
      </GlassSurface>
    </div>
  );
}

// 11 — VisionOS layered: greeting + menu with restrained, real depth.
function TVision() {
  return (
    <div className="pnl-t pnl-t--center">
      <div className="pnl-t-vision">
        <GlassSurface radius={24} className="pnl-t-vision-back" badge={false} />
        <GlassSurface radius={20} className="pnl-t-vision-front" badge>
          <Greet className="pnl-t-island-txt" />
          <Menu size={17} />
        </GlassSurface>
      </div>
    </div>
  );
}

export const TOP_VARIANTS: TopVariant[] = [
  { id: "T1", name: "Floating island", note: "Greeting + menu, compact and detached.", render: () => <TIsland /> },
  { id: "T2", name: "Liquid capsule", note: "Greeting + menu in a wide bar. Closest to today.", render: () => <TCapsule /> },
  { id: "T3", name: "Twin bubbles", note: "A greeting bubble + a menu bubble that ease together.", render: () => <TTwin /> },
  { id: "T4", name: "Dynamic island", note: "A greeting pill that springs open to the menu.", render: () => <TDynamic /> },
  { id: "T5", name: "Edge-mounted bar", note: "Greeting + menu hanging from the top edge.", render: () => <TEdge /> },
  { id: "T6", name: "Glass ribbon", note: "Greeting + menu on a thin, elegant strip.", render: () => <TRibbon /> },
  { id: "T7", name: "Morphing menu", note: "The greeting morphs into the drawer sections.", render: () => <TMorph /> },
  { id: "T8", name: "Expandable corner", note: "Greeting kept; the menu fans sections down.", render: () => <TCorner /> },
  { id: "T9", name: "Split pills", note: "Greeting and menu as two separate glass pieces.", render: () => <TSplit /> },
  { id: "T10", name: "Scroll-reactive", note: "Greeting + menu that compress as you scroll.", render: (c) => <TScroll {...c} /> },
  { id: "T11", name: "VisionOS layered", note: "Greeting + menu with restrained real depth.", render: () => <TVision /> },
];
