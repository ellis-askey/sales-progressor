"use client";
// Forward Liquid-Glass UI — overlays. Self-contained portalled surfaces: each
// re-establishes the .lg-ds glass scope on its own portal root, so it is themed
// correctly even though it escapes any ancestor scope. Focus-trap + spring +
// Esc/scrim, reconciled against the production Drawer/Modal behaviour.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { X, Check, Warning, Info, ArrowUpRight, CaretDown } from "@/components/icons/ph";
import { cn, useEnter, Portal, Frost, useAnchored } from "./primitives";

export type MenuItem = { label: string; icon?: ReactNode; danger?: boolean; onSelect?: () => void };

export function DropdownMenu({ label, items, align = "start" }: { label: ReactNode; items: MenuItem[]; align?: "start" | "end" }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "bottom", align, gap: 6 });
  const v = useEnter(0.42, 0.3);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { const t = e.target as Node; if (floatRef.current?.contains(t) || anchorRef.current?.contains(t)) return; setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); anchorRef.current?.focus(); } };
    document.addEventListener("pointerdown", onDoc); document.addEventListener("keydown", onKey);
    const t = setTimeout(() => floatRef.current?.querySelector("button")?.focus(), 10);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <>
      <button ref={anchorRef} className="tl-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label}<CaretDown weight="bold" /></button>
      {open && <Portal><div ref={floatRef} className="tl-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600, opacity: v, transform: `translateY(${(1 - v) * 6}px) scale(${0.97 + v * 0.03})` }}>
        <Frost radius={13} className="tl-menu" role="menu">{items.map((it, i) => (
          <button key={i} role="menuitem" className={cn("tl-menu-item", it.danger && "tl-menu-item--danger")} onClick={() => { setOpen(false); anchorRef.current?.focus(); it.onSelect?.(); }}>{it.icon}<span>{it.label}</span></button>
        ))}</Frost>
      </div></Portal>}
    </>
  );
}

function trapTab(e: React.KeyboardEvent, container: HTMLElement | null) {
  if (e.key !== "Tab" || !container) return;
  const f = container.querySelectorAll<HTMLElement>('button,textarea,input,a,[tabindex]:not([tabindex="-1"])');
  if (!f.length) return; const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function useEscClose(open: boolean, onClose: () => void, ref: RefObject<HTMLElement>, focusFirst = true) {
  useEffect(() => {
    if (!open) return;
    if (focusFirst) setTimeout(() => ref.current?.querySelector<HTMLElement>("button,input,textarea")?.focus(), 20);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, ref, focusFirst]);
}

export function Dialog({ open, onClose, title, eyebrow, children, footer }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useEnter(0.5, 0.24);
  useEscClose(open, onClose, ref);
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
  const ref = useRef<HTMLDivElement>(null);
  const v = useEnter(0.5, 0.26);
  useEscClose(open, onClose, ref);
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
export function Drawer({ open, onClose, title, eyebrow, children, footer }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useEnter(0.55, 0.16);
  useEscClose(open, onClose, ref);
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
