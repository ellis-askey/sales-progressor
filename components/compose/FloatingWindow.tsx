"use client";

// FloatingWindow — non-modal, draggable window chrome for the quick-action
// composers (New email / New note). Unlike a modal it has NO backdrop: the app
// behind stays bright and fully interactive, so an agent can drag the composer
// aside, move from page to page, and pull information out of the app while they
// write. It owns ONLY the window chrome — drag, snap-to-edge, minimise and
// position persistence — and renders the composer body as children.
//
// Persistence across navigation is free: this is mounted inside the quick-action
// dock, which lives in the persistent agent layout, so an open window (and its
// draft) survives page changes.
//
// Minimise collapses the window to a compact chip parked bottom-right; several
// minimised windows stack via `stackIndex`. Close is guarded by an inline
// "Discard?" confirm so a half-written draft isn't lost to a stray click.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// The most recently touched window sits on top. Module-level so the two windows
// (one email, one note) share a single z-ramp.
let Z_TOP = 1300;

type Pos = { x: number; y: number };

export type FloatingWindowKind = "email" | "note";

export type FloatingWindowProps = {
  kind: FloatingWindowKind;
  title: string;
  subtitle?: string | null;
  theme: "light" | "dark";
  /** Fixed window width in px (v1 has no resize). */
  width: number;
  minimized: boolean;
  /** Slot among the currently-minimised windows (0 = closest to the corner). */
  stackIndex: number;
  closing?: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  /** Begin the composer's close (its exit animation). */
  onClose: () => void;
  /** Fired once the exit animation has finished — the owner unmounts here. */
  onExited?: () => void;
  /** Stamp data-theme on the root so --agent-* tokens resolve. Needed when the
   *  window portals to document.body (the email composer); omit when it portals
   *  inside .agent-shell-root, which already scopes the tokens (the note). */
  scopeTokens?: boolean;
  children: ReactNode;
};

const MARGIN = 18;   // gap kept from the viewport edge when clamping / snapping
const SNAP = 36;     // drop within this many px of an edge → snap flush to it
const CHIP_H = 46;   // minimised chip height (drives the stack offset)

function loadPos(kind: string): Pos | null {
  try {
    const raw = window.localStorage.getItem(`floatwin:${kind}`);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pos>;
    if (typeof p?.x === "number" && typeof p?.y === "number") return { x: p.x, y: p.y };
  } catch { /* ignore malformed / unavailable storage */ }
  return null;
}
function savePos(kind: string, p: Pos) {
  try { window.localStorage.setItem(`floatwin:${kind}`, JSON.stringify(p)); } catch { /* ignore */ }
}

function clampPos(p: Pos, w: number, h: number): Pos {
  const vw = window.innerWidth, vh = window.innerHeight;
  return {
    x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, vw - w - MARGIN)),
    y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, vh - h - MARGIN)),
  };
}

function KindIcon({ kind }: { kind: FloatingWindowKind }) {
  if (kind === "email") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5z" /><path d="M15 4v4a1 1 0 0 0 1 1h4" />
    </svg>
  );
}

export function FloatingWindow({
  kind, title, subtitle, theme, width, minimized, stackIndex,
  closing = false, onMinimize, onRestore, onClose, onExited, scopeTokens = false, children,
}: FloatingWindowProps) {
  const winRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [z, setZ] = useState<number>(() => ++Z_TOP);
  const [confirmClose, setConfirmClose] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Initial placement: last-saved spot for this kind, else lower-right, above
  // where the dock sits. Measured after first paint so we can use real height.
  useEffect(() => {
    const h = winRef.current?.offsetHeight ?? 440;
    const vw = window.innerWidth, vh = window.innerHeight;
    const def: Pos = { x: vw - width - MARGIN, y: Math.max(MARGIN, vh - h - 92) };
    setPos(clampPos(loadPos(kind) ?? def, width, h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the window on-screen when the viewport resizes.
  useEffect(() => {
    function onResize() {
      const h = winRef.current?.offsetHeight ?? 440;
      setPos((p) => (p ? clampPos(p, width, h) : p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width]);

  // Guarantee the close completes even when no animationend fires — reduced
  // motion disables the exit animation, and a minimised window is display:none
  // so it can't animate. The faster animationend path still wins when it runs.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => onExited?.(), 300);
    return () => clearTimeout(t);
  }, [closing, onExited]);

  const bringToFront = useCallback(() => setZ(++Z_TOP), []);

  function onBarPointerDown(e: React.PointerEvent) {
    // Don't start a drag from the title-bar buttons.
    if ((e.target as HTMLElement).closest("[data-fw-nodrag]")) return;
    if (!pos) return;
    bringToFront();
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onBarPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const h = winRef.current?.offsetHeight ?? 440;
    setPos(clampPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, width, h));
  }
  function onBarPointerUp(e: React.PointerEvent) {
    if (!drag.current) return;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    // Snap flush to any edge the window was dropped close to.
    setPos((p) => {
      if (!p) return p;
      const h = winRef.current?.offsetHeight ?? 440;
      const vw = window.innerWidth, vh = window.innerHeight;
      let { x, y } = p;
      if (x <= MARGIN + SNAP) x = MARGIN;
      else if (x >= vw - width - MARGIN - SNAP) x = vw - width - MARGIN;
      if (y <= MARGIN + SNAP) y = MARGIN;
      else if (y >= vh - h - MARGIN - SNAP) y = vh - h - MARGIN;
      const np = clampPos({ x, y }, width, h);
      savePos(kind, np);
      return np;
    });
  }

  function onWinAnimEnd(e: React.AnimationEvent) {
    if (closing && e.target === e.currentTarget) onExited?.();
  }

  // The window and the minimised chip are BOTH kept in the tree; we only toggle
  // which is shown. Crucially the window content (children) stays mounted while
  // minimised, so a rich-text draft held in the DOM isn't wiped by minimising.
  return (
    <>
      <div
        ref={winRef}
        className="fw-win"
        data-fw-theme={theme}
        data-theme={scopeTokens ? theme : undefined}
        data-closing={closing ? "1" : undefined}
        style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, width, zIndex: z, visibility: pos ? "visible" : "hidden", display: minimized ? "none" : undefined }}
        role="dialog"
        aria-label={title}
        aria-hidden={minimized || undefined}
        onPointerDown={bringToFront}
        onAnimationEnd={minimized ? undefined : onWinAnimEnd}
      >
        <div
          className="fw-bar"
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
        >
          <span className="fw-bar-ic"><KindIcon kind={kind} /></span>
          <span className="fw-bar-txt">
            <span className="fw-bar-title">{title}</span>
            {subtitle && <span className="fw-bar-sub">{subtitle}</span>}
          </span>
          <div className="fw-bar-actions" data-fw-nodrag>
            {confirmClose ? (
              <span className="fw-confirm">
                <span className="fw-confirm-q">Discard?</span>
                <button className="fw-confirm-yes" onClick={onClose}>Discard</button>
                <button className="fw-confirm-no" onClick={() => setConfirmClose(false)}>Keep</button>
              </span>
            ) : (
              <>
                <button className="fw-ic" aria-label="Minimise" onClick={onMinimize}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 18h12" /></svg>
                </button>
                <button className="fw-ic" aria-label="Close" onClick={() => setConfirmClose(true)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
        <div className="fw-content">{children}</div>
      </div>

      {minimized && (
        <div
          className="fw-chip"
          data-fw-theme={theme}
          data-theme={scopeTokens ? theme : undefined}
          data-closing={closing ? "1" : undefined}
          style={{ right: MARGIN, bottom: MARGIN + stackIndex * (CHIP_H + 10), zIndex: z }}
          role="button"
          tabIndex={0}
          aria-label={`Restore ${title}`}
          onClick={onRestore}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRestore(); } }}
          onAnimationEnd={onWinAnimEnd}
        >
          <span className="fw-chip-ic"><KindIcon kind={kind} /></span>
          <span className="fw-chip-txt">
            <span className="fw-chip-title">{title}</span>
            {subtitle && <span className="fw-chip-sub">{subtitle}</span>}
          </span>
          <button data-fw-nodrag className="fw-chip-x" aria-label="Close" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <style>{FW_CSS}</style>
    </>
  );
}

const FW_CSS = `
.fw-win{ position:fixed; display:flex; flex-direction:column; overflow:hidden;
  max-height:min(86vh,760px); border-radius:16px;
  border:1px solid rgba(255,255,255,0.5); border-top:2px solid var(--agent-coral-deep,#FF6B4A);
  background:var(--agent-surface-elevated,#fff);
  box-shadow:0 26px 70px rgba(45,24,16,0.30), 0 2px 10px rgba(45,24,16,0.14);
  animation:fwIn .30s cubic-bezier(.34,1.4,.5,1) both; }
.fw-win[data-fw-theme="dark"]{ border-color:rgba(255,255,255,0.08); background:var(--agent-surface-elevated,#1b1f29); box-shadow:0 26px 70px rgba(0,0,0,0.55); }
.fw-win[data-closing="1"]{ animation:fwOut .20s ease both; }
@keyframes fwIn{ from{ opacity:0; transform:translateY(10px) scale(.985) } to{ opacity:1; transform:none } }
@keyframes fwOut{ from{ opacity:1; transform:none } to{ opacity:0; transform:translateY(8px) scale(.985) } }

/* Title bar — the drag handle. */
.fw-bar{ flex-shrink:0; display:flex; align-items:center; gap:10px; padding:9px 10px 9px 14px; cursor:grab;
  color:#fff; background:linear-gradient(180deg,var(--agent-coral,#FF8A65) 0%,var(--agent-coral-deep,#FF6B4A) 100%);
  touch-action:none; user-select:none; }
.fw-bar:active{ cursor:grabbing; }
.fw-bar-ic{ display:inline-flex; opacity:.95; }
.fw-bar-txt{ flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.15; }
.fw-bar-title{ font-size:13px; font-weight:700; letter-spacing:-0.01em; }
.fw-bar-sub{ font-size:11px; font-weight:500; opacity:.82; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fw-bar-actions{ display:flex; align-items:center; gap:4px; flex-shrink:0; }
.fw-ic{ width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; border:none; border-radius:9px;
  background:rgba(255,255,255,0.14); color:#fff; cursor:pointer; transition:background .18s ease; }
.fw-ic:hover{ background:rgba(255,255,255,0.28); }
.fw-ic:active{ background:rgba(255,255,255,0.22); }

/* Inline discard confirm. */
.fw-confirm{ display:inline-flex; align-items:center; gap:6px; }
.fw-confirm-q{ font-size:11.5px; font-weight:600; opacity:.95; }
.fw-confirm-yes,.fw-confirm-no{ border:none; border-radius:8px; padding:5px 10px; font-family:inherit; font-size:11.5px; font-weight:700; cursor:pointer; }
.fw-confirm-yes{ background:#fff; color:var(--agent-coral-deep,#E8542F); }
.fw-confirm-no{ background:rgba(255,255,255,0.18); color:#fff; }
.fw-confirm-no:hover{ background:rgba(255,255,255,0.3); }

/* Body surface — the composer renders de-chromed inside this. */
.fw-content{ flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; background:var(--agent-surface-elevated,#fff); }
.fw-win[data-fw-theme="dark"] .fw-content{ background:var(--agent-surface-elevated,#1b1f29); }

/* Minimised chip. */
.fw-chip{ position:fixed; display:flex; align-items:center; gap:10px; width:230px; max-width:calc(100vw - 36px); height:${CHIP_H}px;
  padding:0 8px 0 13px; border-radius:13px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.5); border-left:3px solid var(--agent-coral-deep,#FF6B4A);
  background:var(--agent-surface-elevated,#fff); box-shadow:0 12px 30px rgba(45,24,16,0.22);
  animation:fwChipIn .22s cubic-bezier(.34,1.4,.5,1) both; }
.fw-chip[data-fw-theme="dark"]{ border-color:rgba(255,255,255,0.08); border-left-color:var(--agent-coral-deep,#FF6B4A); background:var(--agent-surface-elevated,#1b1f29); box-shadow:0 12px 30px rgba(0,0,0,0.5); }
@keyframes fwChipIn{ from{ opacity:0; transform:translateY(8px) } to{ opacity:1; transform:none } }
.fw-chip[data-closing="1"]{ animation:fwChipOut .18s ease both; }
@keyframes fwChipOut{ from{ opacity:1; transform:none } to{ opacity:0; transform:translateY(8px) } }
.fw-chip-ic{ display:inline-flex; color:var(--agent-coral-deep,#E8542F); flex-shrink:0; }
.fw-chip-txt{ flex:1; min-width:0; display:flex; flex-direction:column; line-height:1.15; }
.fw-chip-title{ font-size:12.5px; font-weight:700; color:var(--agent-text-primary,#1b1f29); }
.fw-chip[data-fw-theme="dark"] .fw-chip-title{ color:var(--agent-text-primary,#f3f4f8); }
.fw-chip-sub{ font-size:11px; font-weight:500; color:var(--agent-text-secondary,#6b7280); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fw-chip-x{ width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border:none; border-radius:8px;
  background:none; color:var(--agent-text-muted,#9a8a7f); cursor:pointer; transition:background .18s ease,color .18s ease; }
.fw-chip-x:hover{ background:var(--agent-surface-nested,rgba(15,23,42,0.06)); color:var(--agent-text-primary,#1b1f29); }

@media (prefers-reduced-motion:reduce){
  .fw-win,.fw-chip{ animation:none; }
}
`;

export default FloatingWindow;
