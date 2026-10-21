"use client";

// StickyNote — a draggable, resizable, editable paper note. Pointer-event based
// (no drag lib), persistence-agnostic: it just reports changes up via onChange so
// the sandbox can use localStorage and the real feature can hit an API later.

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { X, CaretDown } from "@phosphor-icons/react";

export type StickyColour = "butter" | "coral" | "sage" | "sky" | "lilac" | "slate";

export type StickyNoteData = {
  id: string;
  x: number; y: number;
  w: number; h: number;
  colour: StickyColour;
  text: string;
  collapsed: boolean;
  z: number;
  author: string;
  createdAt: number;
};

// Muted, warm-theme pastels (never neon). fill = paper, edge = hairline + the
// slightly darker adhesive strip, dot = the colour swatch.
export const PALETTE: Record<StickyColour, { fill: string; edge: string; strip: string; dot: string }> = {
  butter: { fill: "#FCF3C9", edge: "#ECD89A", strip: "#F6E9A8", dot: "#E7CB55" },
  coral:  { fill: "#FBDDD4", edge: "#F0BFB1", strip: "#F7CcC0", dot: "#EC9480" },
  sage:   { fill: "#DCEBDA", edge: "#BBD6B8", strip: "#CFE3CC", dot: "#8BBC88" },
  sky:    { fill: "#D8E8F4", edge: "#B6D1E8", strip: "#C9DEEF", dot: "#80B2DC" },
  lilac:  { fill: "#E8E0F3", edge: "#CFC2E6", strip: "#DCD2EE", dot: "#AF96D6" },
  slate:  { fill: "#E8E5DF", edge: "#D1CCC3", strip: "#DED9D1", dot: "#A69D91" },
};
export const PALETTE_ORDER: StickyColour[] = ["butter", "coral", "sage", "sky", "lilac", "slate"];

const MIN_W = 156, MIN_H = 120, MAX_W = 520, MAX_H = 640;
const INK = "#3b332a"; // warm near-black, readable on every pastel

// Stable small tilt per note so it reads as hand-placed and never jitters.
function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return ((h % 9) - 4) * 0.5; // ~ -2deg .. +2deg
}

function relWhen(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export function StickyNote({
  note, onChange, onRemove, onFocusNote,
}: {
  note: StickyNoteData;
  onChange: (patch: Partial<StickyNoteData>) => void;
  onRemove: () => void;
  onFocusNote: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const grab = useRef({ px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => { const r = requestAnimationFrame(() => setPlaced(true)); return () => cancelAnimationFrame(r); }, []);
  // Focus the textarea when a fresh (empty) note is placed.
  useEffect(() => { if (note.text === "") taRef.current?.focus(); /* eslint-disable-next-line */ }, []);

  const c = PALETTE[note.colour];
  const tilt = tiltFor(note.id);
  const active = dragging || resizing;

  // ── drag (grab the top strip) ──
  function startDrag(e: RPointerEvent) {
    if ((e.target as HTMLElement).closest("[data-ctl]")) return; // not when hitting a control
    onFocusNote();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    grab.current = { px: e.clientX, py: e.clientY, x: note.x, y: note.y, w: note.w, h: note.h };
    setDragging(true);
    setPaletteOpen(false);
  }
  function moveDrag(e: RPointerEvent) {
    if (!dragging) return;
    onChange({ x: Math.max(0, grab.current.x + (e.clientX - grab.current.px)), y: Math.max(0, grab.current.y + (e.clientY - grab.current.py)) });
  }
  function endDrag(e: RPointerEvent) {
    if (!dragging) return;
    setDragging(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  // ── resize (bottom-right grip) ──
  function startResize(e: RPointerEvent) {
    e.stopPropagation();
    onFocusNote();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    grab.current = { px: e.clientX, py: e.clientY, x: note.x, y: note.y, w: note.w, h: note.h };
    setResizing(true);
  }
  function moveResize(e: RPointerEvent) {
    if (!resizing) return;
    onChange({
      w: Math.min(MAX_W, Math.max(MIN_W, grab.current.w + (e.clientX - grab.current.px))),
      h: Math.min(MAX_H, Math.max(MIN_H, grab.current.h + (e.clientY - grab.current.py))),
    });
  }
  function endResize(e: RPointerEvent) {
    if (!resizing) return;
    setResizing(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  // Layered, warm shadows (contact + ambient) with an inner top highlight, so the
  // paper has real form. Deepens as the note lifts on hover, then on drag.
  const SH_REST = "inset 0 1px 0 rgba(255,255,255,.55), 0 1px 1.5px rgba(45,30,12,.08), 0 8px 18px -6px rgba(45,30,12,.20), 0 2px 6px -2px rgba(45,30,12,.12)";
  const SH_HOVER = "inset 0 1px 0 rgba(255,255,255,.6), 0 2px 3px rgba(45,30,12,.09), 0 18px 32px -8px rgba(45,30,12,.26), 0 5px 12px -4px rgba(45,30,12,.15)";
  const SH_DRAG = "inset 0 1px 0 rgba(255,255,255,.6), 0 3px 5px rgba(45,30,12,.10), 0 28px 54px -10px rgba(45,30,12,.32), 0 10px 20px -6px rgba(45,30,12,.20)";

  const style: CSSProperties = {
    position: "absolute",
    left: note.x, top: note.y,
    width: note.w, height: note.collapsed ? undefined : note.h,
    zIndex: note.z,
    transform: active
      ? "rotate(0deg) scale(1.028)"
      : `rotate(${tilt}deg) translateY(${hovered ? -3 : 0}px) scale(${placed ? (hovered ? 1.012 : 1) : 0.9})`,
    opacity: placed ? 1 : 0,
    transition: active ? "none" : "transform .26s cubic-bezier(.2,1,.3,1), opacity .28s ease, box-shadow .2s ease",
    boxShadow: active ? SH_DRAG : hovered ? SH_HOVER : SH_REST,
    // Solid pastel with a top light-sheen fading out and a faint bottom shade —
    // the paper catches light instead of reading as a flat fill.
    background: `linear-gradient(180deg, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 16%, rgba(45,30,12,.045) 100%), ${c.fill}`,
    border: `1px solid ${c.edge}`,
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    color: INK,
  };

  return (
    <div style={style} onPointerDown={onFocusNote} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} className="sn">
      {/* top of the paper = the drag handle; controls sit on it, calm until hover */}
      <div
        className="sn-bar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button data-ctl type="button" className="sn-dot" title="Colour" style={{ background: c.dot }} onPointerDown={(e) => e.stopPropagation()} onClick={() => setPaletteOpen((v) => !v)} />
        <span className="sn-spacer" />
        <button data-ctl type="button" className="sn-ic sn-collapse" title={note.collapsed ? "Expand" : "Collapse"} onPointerDown={(e) => e.stopPropagation()} onClick={() => onChange({ collapsed: !note.collapsed })}>
          <CaretDown size={13} weight="bold" style={{ transform: note.collapsed ? "rotate(-90deg)" : "none", transition: "transform .16s" }} />
        </button>
        <button data-ctl type="button" className="sn-ic sn-x" title="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove}>
          <X size={13} weight="bold" />
        </button>
      </div>

      {paletteOpen && (
        <div className="sn-palette" data-ctl onPointerDown={(e) => e.stopPropagation()}>
          {PALETTE_ORDER.map((k) => (
            <button key={k} type="button" className={`sn-sw${k === note.colour ? " on" : ""}`} style={{ background: PALETTE[k].dot }} title={k} onClick={() => { onChange({ colour: k }); setPaletteOpen(false); }} />
          ))}
        </div>
      )}

      {!note.collapsed && (
        <>
          <textarea
            ref={taRef}
            className="sn-body"
            value={note.text}
            placeholder="Type a note…"
            onChange={(e) => onChange({ text: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
          />
          <div className="sn-foot">{note.author} · {relWhen(note.createdAt)}</div>
          <div
            className="sn-resize"
            title="Drag to resize"
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          >
            <svg viewBox="0 0 10 10" width="10" height="10"><path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          </div>
        </>
      )}
    </div>
  );
}
