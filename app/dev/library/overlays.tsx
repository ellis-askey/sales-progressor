"use client";
// TSP library · Overlays. Built on our proven overlay engine (Portal + anchored
// positioning + focus-trap + spring + the frosted surface) from /dev/hub-slice &
// /dev/hub-glass-v3, plus theatom GlassMenu/GlassSheet interaction. motion-
// primitives' dialog/popover were NOT used — they need framer-motion (awaiting
// approval). Frosted surface (not the lens) for small portalled overlays, per the
// material doctrine. Registry in OVERLAY_REG.

import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject,
} from "react";
import { X, Check, Warning, Info, CaretDown, ArrowUpRight, Bell, PaperPlaneTilt } from "@phosphor-icons/react";
import { cn, useEnter, Portal, useAnchored, Frost } from "./lib";
import type { RegEntry } from "./registry";

export type MenuItem = { label: string; icon?: ReactNode; danger?: boolean; onSelect?: () => void };

function useDismiss(open: boolean, onClose: () => void, floatRef: RefObject<HTMLElement>, anchorRef?: RefObject<HTMLElement>, restoreFocus = true) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { const t = e.target as Node; if (floatRef.current?.contains(t) || anchorRef?.current?.contains(t)) return; onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { onClose(); if (restoreFocus) (anchorRef?.current as HTMLElement)?.focus?.(); } };
    document.addEventListener("pointerdown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, onClose, floatRef, anchorRef, restoreFocus]);
}
function trapTab(e: React.KeyboardEvent, container: HTMLElement | null) {
  if (e.key !== "Tab" || !container) return;
  const f = container.querySelectorAll<HTMLElement>('button,textarea,input,a,[tabindex]:not([tabindex="-1"])');
  if (!f.length) return; const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (<>{items.map((it, i) => (
    <button key={i} role="menuitem" className={cn("tl-menu-item", it.danger && "tl-menu-item--danger")} onClick={() => { onClose(); it.onSelect?.(); }}>
      {it.icon}<span>{it.label}</span>
    </button>
  ))}</>);
}

/* ── DropdownMenu ────────────────────────────────────────────────────────────── */
export function DropdownMenu({ label, items, align = "start" }: { label: ReactNode; items: MenuItem[]; align?: "start" | "end" }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "bottom", align, gap: 6 });
  const v = useEnter(0.42, 0.3);
  useDismiss(open, () => setOpen(false), floatRef, anchorRef);
  useEffect(() => { if (open) setTimeout(() => floatRef.current?.querySelector("button")?.focus(), 10); }, [open]);
  return (
    <>
      <button ref={anchorRef} className="tl-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label}<CaretDown weight="bold" /></button>
      {open && <Portal><div ref={floatRef} className="tl-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600, opacity: v, transform: `translateY(${(1 - v) * 6}px) scale(${0.97 + v * 0.03})` }}>
        <Frost radius={13} className="tl-menu" role="menu"><MenuList items={items} onClose={() => { setOpen(false); anchorRef.current?.focus(); }} /></Frost>
      </div></Portal>}
    </>
  );
}

/* ── ContextMenu (right-click) ───────────────────────────────────────────────── */
export function ContextMenu({ items, children }: { items: MenuItem[]; children: ReactNode }) {
  const floatRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const v = useEnter(0.4, 0.3);
  useEffect(() => {
    if (!pos) return;
    const onDoc = (e: PointerEvent) => { if (!floatRef.current?.contains(e.target as Node)) setPos(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    document.addEventListener("pointerdown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [pos]);
  return (
    <>
      <div className="tl-ctxarea" onContextMenu={(e) => { e.preventDefault(); setPos({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 220) }); }}>{children}</div>
      {pos && <Portal><div ref={floatRef} className="tl-layer" style={{ position: "fixed", top: pos.y, left: pos.x, zIndex: 1600, opacity: v, transform: `scale(${0.97 + v * 0.03})` }}>
        <Frost radius={13} className="tl-menu" role="menu"><MenuList items={items} onClose={() => setPos(null)} /></Frost>
      </div></Portal>}
    </>
  );
}

/* ── Popover (interactive) ───────────────────────────────────────────────────── */
export function Popover({ trigger, children, align = "start", width = 300 }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end"; width?: number }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "bottom", align, gap: 8 });
  const v = useEnter(0.46, 0.28);
  useDismiss(open, () => setOpen(false), floatRef, anchorRef);
  return (
    <>
      <button ref={anchorRef} className="tl-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && <Portal><div ref={floatRef} className="tl-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600, width, opacity: v, transform: `translateY(${(1 - v) * 6}px)` }}>
        <Frost radius={16} className="tl-pop">{children}</Frost>
      </div></Portal>}
    </>
  );
}

/* ── Tooltip (hover + focus) ─────────────────────────────────────────────────── */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "top", align: "center", gap: 7 });
  const show = () => { t.current = setTimeout(() => setOpen(true), 350); };
  const hide = () => { if (t.current) clearTimeout(t.current); setOpen(false); };
  return (
    <span ref={anchorRef} className="tl-tip-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={() => setOpen(true)} onBlur={hide} tabIndex={0}>
      {children}
      {open && <Portal><div ref={floatRef} className="tl-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1700, pointerEvents: "none" }}><Frost radius={10} className="tl-tip" role="tooltip">{content}</Frost></div></Portal>}
    </span>
  );
}

/* ── Dialog + ConfirmDialog (focus-trapped, spring) ──────────────────────────── */
export function Dialog({ open, onClose, title, eyebrow, children, footer }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useEnter(0.5, 0.24);
  useEffect(() => { if (open) { setTimeout(() => ref.current?.querySelector<HTMLElement>("button,input,textarea")?.focus(), 20); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); } }, [open, onClose]);
  if (!open) return null;
  return (
    <Portal><div className="tl-scrim" onClick={onClose}>
      <Frost radius={20} className="tl-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => trapTab(e, ref.current)} ref={ref} style={{ opacity: v, transform: `translateY(${(1 - v) * 10}px) scale(${0.96 + v * 0.04})` }}>
        <div className="tl-dialog-head"><div>{eyebrow && <span className="tl-eyebrow">{eyebrow}</span>}<strong>{title}</strong></div><button className="tl-icon-btn" aria-label="Close" onClick={onClose}><X weight="bold" /></button></div>
        <div className="tl-dialog-body">{children}</div>
        {footer && <div className="tl-dialog-foot">{footer}</div>}
      </Frost>
    </div></Portal>
  );
}
export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel?: string; danger?: boolean }) {
  const v = useEnter(0.5, 0.26);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setTimeout(() => ref.current?.querySelector<HTMLElement>("button")?.focus(), 20); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); } }, [open, onClose]);
  if (!open) return null;
  return (
    <Portal><div className="tl-scrim" onClick={onClose}>
      <Frost radius={18} className="tl-confirm" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => trapTab(e, ref.current)} ref={ref} style={{ opacity: v, transform: `scale(${0.96 + v * 0.04})` }}>
        <span className={cn("tl-confirm-ic", danger && "tl-confirm-ic--danger")}><Warning weight="fill" /></span>
        <strong>{title}</strong><p>{body}</p>
        <div className="tl-confirm-foot"><button className="tl-btn tl-btn--ghost tl-btn--sm" onClick={onClose}>Cancel</button><button className={cn("tl-btn tl-btn--sm", danger ? "tl-btn--danger" : "tl-btn--primary")} onClick={() => { onClose(); onConfirm(); }}>{confirmLabel}</button></div>
      </Frost>
    </div></Portal>
  );
}

/* ── Drawer (side) + Sheet (bottom) ──────────────────────────────────────────── */
export function Drawer({ open, onClose, title, eyebrow, children, footer }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useEnter(0.55, 0.16);
  useEffect(() => { if (open) { setTimeout(() => ref.current?.querySelector<HTMLElement>("button,input,textarea")?.focus(), 20); const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); } }, [open, onClose]);
  if (!open) return null;
  return (
    <Portal><div className="tl-scrim tl-scrim--end" onClick={onClose}>
      <Frost radius={0} className="tl-drawer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => trapTab(e, ref.current)} ref={ref} style={{ transform: `translateX(${(1 - v) * 100}%)` }}>
        <div className="tl-dialog-head"><div>{eyebrow && <span className="tl-eyebrow">{eyebrow}</span>}<strong>{title}</strong></div><button className="tl-icon-btn" aria-label="Close" onClick={onClose}><X weight="bold" /></button></div>
        <div className="tl-drawer-body">{children}</div>
        {footer && <div className="tl-dialog-foot">{footer}</div>}
      </Frost>
    </div></Portal>
  );
}
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useEnter(0.5, 0.2);
  useEffect(() => { if (open) { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); } }, [open, onClose]);
  if (!open) return null;
  return (
    <Portal><div className="tl-scrim tl-scrim--bottom" onClick={onClose}>
      <Frost radius={22} className="tl-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => trapTab(e, ref.current)} ref={ref} style={{ transform: `translateY(${(1 - v) * 100}%)` }}>
        <span className="tl-sheet-grab" aria-hidden />
        <div className="tl-sheet-head"><strong>{title}</strong></div>
        <div className="tl-drawer-body">{children}</div>
        {footer && <div className="tl-dialog-foot">{footer}</div>}
      </Frost>
    </div></Portal>
  );
}

/* ── Toasts + Notifications (provider + hook) ────────────────────────────────── */
type ToastInput = { text?: string; tone?: "ok" | "info" | "warn"; title?: string; body?: string; action?: { label: string; onClick: () => void } };
type ToastItem = ToastInput & { id: number };
const ToastCtx = createContext<(t: ToastInput) => void>(() => {});
export function useToast() { return useContext(ToastCtx); }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = (t: ToastInput) => { const id = ++seq.current; setItems((a) => [...a, { id, ...t }]); setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), t.body ? 5200 : 3200); };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <Portal><div className="tl-toast-stack">{items.map((t) => <ToastView key={t.id} t={t} onClose={() => setItems((a) => a.filter((x) => x.id !== t.id))} />)}</div></Portal>
    </ToastCtx.Provider>
  );
}
function ToastView({ t, onClose }: { t: ToastItem; onClose: () => void }) {
  const v = useEnter(0.5, 0.3);
  const Icon = t.tone === "warn" ? Warning : t.tone === "info" ? Info : Check;
  if (t.body || t.title) return (
    <Frost radius={14} className="tl-note" role="status" style={{ opacity: v, transform: `translateY(${(1 - v) * 14}px)` }}>
      <span className={cn("tl-note-ic", t.tone && `tl-note-ic--${t.tone}`)}><Icon weight="fill" /></span>
      <div className="tl-note-body"><strong>{t.title ?? t.text}</strong>{t.body && <span>{t.body}</span>}{t.action && <button className="tl-note-act" onClick={() => { t.action!.onClick(); onClose(); }}>{t.action.label} <ArrowUpRight weight="bold" /></button>}</div>
      <button className="tl-note-close" aria-label="Dismiss" onClick={onClose}><X weight="bold" /></button>
    </Frost>
  );
  return <Frost radius={13} className="tl-toast" role="status" style={{ opacity: v, transform: `translateY(${(1 - v) * 14}px)` }}><span className={cn("tl-toast-ic", t.tone && `tl-toast-ic--${t.tone}`)}><Icon weight="bold" /></span>{t.text}</Frost>;
}

export const OVERLAY_REG: RegEntry[] = [
  { name: "DropdownMenu", purpose: "Actions/options from a trigger.", source: "Our proven overlay engine (Portal + anchored + frosted) from /dev/hub-glass-v3; theatom GlassMenu interaction.", licence: "TSP / theatom MIT", adaptations: "Frosted (not lens), flip/clamp positioning, keyboard + Esc + outside close.", variants: "items with icon/danger; align start/end", states: "closed · open (spring) · item hover/focus · danger", importPath: "app/dev/library/overlays.tsx → DropdownMenu", whenToUse: "Row/overflow menus, secondary actions." },
  { name: "ContextMenu", purpose: "Right-click actions.", source: "Our overlay engine, positioned at pointer.", licence: "TSP", adaptations: "onContextMenu → menu at cursor; viewport-clamped.", variants: "any items", states: "closed · open · item hover", importPath: "app/dev/library/overlays.tsx → ContextMenu", whenToUse: "Power-user right-click on rows/cards." },
  { name: "Popover", purpose: "Rich interactive content from a trigger.", source: "Our overlay engine; motion-primitives morphing-popover NOT used (needs framer-motion).", licence: "TSP", adaptations: "Frosted panel, anchored, interactive content, outside/Esc close.", variants: "width; align", states: "closed · open (spring) · interactive", importPath: "app/dev/library/overlays.tsx → Popover", whenToUse: "Forecast/detail reveals, small forms." },
  { name: "Tooltip", purpose: "Brief label on hover/focus.", source: "Our overlay engine (hover + focus, delay).", licence: "TSP", adaptations: "350ms delay, top-centre, pointer-events none.", variants: "text", states: "hidden · shown (hover/focus)", importPath: "app/dev/library/overlays.tsx → Tooltip", whenToUse: "Icon-only controls, truncated text." },
  { name: "Dialog", purpose: "Focused modal task.", source: "Our proven focus-trapped dialog (/dev/hub-slice).", licence: "TSP", adaptations: "Frosted, focus-trap, spring, scrim, Esc/scrim close.", variants: "eyebrow/title/body/footer", states: "closed · open (spring) · focus-trapped", importPath: "app/dev/library/overlays.tsx → Dialog", whenToUse: "A single short task that interrupts the flow." },
  { name: "ConfirmDialog", purpose: "Confirm a destructive/irreversible action.", source: "Our dialog, alertdialog role.", licence: "TSP", adaptations: "Warning icon, Cancel + (danger) confirm; focus on action.", variants: "danger; confirm label", states: "closed · open · danger", importPath: "app/dev/library/overlays.tsx → ConfirmDialog", whenToUse: "Withdraw, delete-equivalent, send-to-all." },
  { name: "Drawer", purpose: "Side panel task (composer, detail).", source: "Our proven side drawer (/dev/hub-slice chase drawer).", licence: "TSP", adaptations: "Right slide (spring), focus-trap, Esc/scrim.", variants: "eyebrow/title/body/footer", states: "closed · open (slide) · focus-trapped", importPath: "app/dev/library/overlays.tsx → Drawer", whenToUse: "Composers and detail work beside the page." },
  { name: "Sheet", purpose: "Bottom sheet (mobile / progressive).", source: "theatom GlassSheet interaction + our overlay engine.", licence: "TSP / theatom MIT", adaptations: "Bottom slide, grabber, Esc/scrim.", variants: "title/body/footer", states: "closed · open (slide up)", importPath: "app/dev/library/overlays.tsx → Sheet", whenToUse: "Mobile actions / progressive disclosure." },
  { name: "Toast", purpose: "Transient confirmation.", source: "Our toast; provider + useToast hook.", licence: "TSP", adaptations: "Stacked, auto-dismiss, tone (ok/info/warn), frosted, spring.", variants: "tone", states: "enter (spring) · auto-dismiss", importPath: "app/dev/library/overlays.tsx → ToastProvider / useToast", whenToUse: "Feedback after an action (chase sent, date set)." },
  { name: "Notification", purpose: "Richer toast with title/body/action.", source: "Our toast, extended.", licence: "TSP", adaptations: "Title + body + optional action + dismiss.", variants: "tone; action", states: "enter · dismiss · action", importPath: "app/dev/library/overlays.tsx → useToast({title,body,action})", whenToUse: "Events that deserve a line of context + a jump-to." },
];

export const OVERLAY_CSS = `
.tl-trigger{ display:inline-flex; align-items:center; gap:7px; font:inherit; font-size:13.5px; font-weight:600; color:var(--lg-ink); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:11px; padding:9px 13px; cursor:pointer; transition:border-color .2s,background .2s; } .tl-trigger:hover{ border-color:var(--lg-ink-3); } .tl-trigger svg{ width:14px; height:14px; color:var(--lg-ink-3); } .tl-trigger:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tl-menu{ min-width:210px; padding:6px; } .tl-menu-item{ display:flex; align-items:center; gap:10px; width:100%; text-align:left; font:inherit; font-size:13.5px; font-weight:500; color:var(--lg-ink); background:none; border:none; padding:9px 11px; border-radius:9px; cursor:pointer; transition:background .15s; } .tl-menu-item svg{ width:15px; height:15px; color:var(--lg-ink-3); } .tl-menu-item span{ flex:1; } .tl-menu-item:hover,.tl-menu-item:focus-visible{ background:var(--lg-hover); outline:none; } .tl-menu-item--danger{ color:var(--lg-danger-ink); } .tl-menu-item--danger svg{ color:var(--lg-danger-ink); }
.tl-ctxarea{ display:inline-block; }
.tl-pop{ padding:14px; } .tl-pop > *{ position:relative; z-index:1; }
.tl-tip-anchor{ display:inline-flex; outline:none; } .tl-tip{ padding:7px 11px; font-size:12px; font-weight:550; color:var(--lg-ink); white-space:nowrap; }

.tl-scrim{ position:fixed; inset:0; z-index:1650; background:rgba(0,0,0,.44); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; padding:20px; animation:tlfadein .22s; } @keyframes tlfadein{ from{opacity:0} to{opacity:1} }
.tl-scrim--end{ justify-content:flex-end; align-items:stretch; padding:0; } .tl-scrim--bottom{ align-items:flex-end; justify-content:center; padding:0; }
.tl-dialog{ width:min(440px,100%); padding:0; } .tl-dialog > *{ position:relative; z-index:1; }
.tl-dialog-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px 20px 12px; } .tl-dialog-head strong{ display:block; font-size:17px; font-weight:750; } .tl-eyebrow{ display:block; font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--lg-accent-ink); margin-bottom:3px; }
.tl-icon-btn{ width:32px; height:32px; border-radius:9px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; } .tl-icon-btn:hover{ color:var(--lg-ink); } .tl-icon-btn svg{ width:14px; height:14px; } .tl-icon-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.tl-dialog-body{ padding:4px 20px 18px; font-size:13.5px; color:var(--lg-ink-2); line-height:1.55; } .tl-dialog-foot{ display:flex; justify-content:flex-end; gap:9px; padding:14px 20px; border-top:1px solid var(--lg-line-2); }
.tl-confirm{ width:min(380px,100%); padding:22px; text-align:center; } .tl-confirm > *{ position:relative; z-index:1; } .tl-confirm-ic{ display:inline-grid; place-items:center; width:46px; height:46px; border-radius:50%; background:var(--lg-accent-soft); color:var(--lg-accent-ink); margin-bottom:12px; } .tl-confirm-ic svg{ width:22px; height:22px; } .tl-confirm-ic--danger{ background:rgba(255,69,58,.16); color:var(--lg-danger-ink); } .tl-confirm strong{ display:block; font-size:16px; font-weight:750; } .tl-confirm p{ font-size:13px; color:var(--lg-ink-2); margin:7px 0 18px; line-height:1.5; } .tl-confirm-foot{ display:flex; justify-content:center; gap:9px; }
.tl-drawer{ width:min(440px,100%); height:100%; border-radius:0; border-left:1px solid var(--lg-line); display:flex; flex-direction:column; } .tl-drawer-body{ flex:1; overflow:auto; padding:18px 20px; font-size:13.5px; color:var(--lg-ink-2); line-height:1.55; }
.tl-sheet{ width:100%; max-width:640px; border-radius:22px 22px 0 0; padding-bottom:6px; } .tl-sheet-grab{ display:block; width:38px; height:4px; border-radius:999px; background:var(--lg-line); margin:10px auto 2px; } .tl-sheet-head{ padding:6px 20px 10px; } .tl-sheet-head strong{ font-size:16px; font-weight:750; }

.tl-toast-stack{ position:fixed; z-index:1700; right:22px; bottom:22px; display:flex; flex-direction:column; gap:10px; align-items:flex-end; } @media (max-width:560px){ .tl-toast-stack{ left:16px; right:16px; align-items:stretch; } }
.tl-toast{ display:inline-flex; align-items:center; gap:9px; padding:11px 15px; font-size:13px; font-weight:550; color:var(--lg-ink); } .tl-toast-ic{ display:inline-grid; place-items:center; color:#5ce08a; } .tl-toast-ic svg{ width:14px; height:14px; } .tl-toast-ic--info{ color:var(--lg-info); } .tl-toast-ic--warn{ color:var(--lg-warn); }
.tl-note{ display:flex; align-items:flex-start; gap:11px; padding:13px 14px; width:min(360px,calc(100vw - 32px)); } .tl-note-ic{ display:inline-grid; place-items:center; width:30px; height:30px; border-radius:9px; background:rgba(48,209,88,.16); color:#5ce08a; flex-shrink:0; } .tl-note-ic svg{ width:16px; height:16px; } .tl-note-ic--info{ background:rgba(94,155,255,.16); color:var(--lg-info); } .tl-note-ic--warn{ background:rgba(255,159,10,.16); color:var(--lg-warn); }
.tl-note-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; } .tl-note-body strong{ font-size:13px; font-weight:650; } .tl-note-body span{ font-size:12px; color:var(--lg-ink-2); line-height:1.45; } .tl-note-act{ align-self:flex-start; margin-top:6px; display:inline-flex; align-items:center; gap:4px; font:inherit; font-size:12px; font-weight:650; color:var(--lg-accent-ink); background:none; border:none; padding:0; cursor:pointer; } .tl-note-act svg{ width:11px; height:11px; }
.tl-note-close{ width:22px; height:22px; border-radius:6px; display:grid; place-items:center; background:none; border:none; color:var(--lg-ink-3); cursor:pointer; flex-shrink:0; } .tl-note-close:hover{ color:var(--lg-ink); } .tl-note-close svg{ width:12px; height:12px; }
`;
