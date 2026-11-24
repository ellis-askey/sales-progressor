"use client";
// Forward Liquid-Glass UI — form controls. Canonical home. Reconciled against the
// production components/ui counterparts for API/behaviour; Liquid-Glass skin.

import {
  useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes,
  type ButtonHTMLAttributes, type TextareaHTMLAttributes, type RefObject,
} from "react";
import { MagnifyingGlass, X, Check, CaretDown, CaretLeft, CaretRight, Calendar } from "@/components/icons/ph";
import { cn, useSpringTo, useReducedMotion, Portal, useAnchored, Frost, TravellingSelection } from "./primitives";

export type BtnVariant = "primary" | "secondary" | "subtle" | "ghost" | "danger";
export type BtnSize = "sm" | "md" | "lg";
export function Button({ variant = "secondary", size = "md", icon = false, loading = false, full = false, children, className = "", disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; icon?: boolean; loading?: boolean; full?: boolean }) {
  const reduced = useReducedMotion();
  const [press, setPress] = useState(false);
  const s = useSpringTo(press ? 0.95 : 1, 0.26, 0.42, !reduced);
  return (
    <button className={cn("tl-btn", `tl-btn--${variant}`, `tl-btn--${size}`, icon && "tl-btn--icon", full && "tl-btn--full", className)}
      style={{ transform: `scale(${s})` }} disabled={disabled || loading}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)} {...rest}>
      {loading ? <span className="tl-spin" /> : children}
    </button>
  );
}
export function IconButton({ label, children, variant = "subtle", ...rest }: { label: string; variant?: BtnVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button icon variant={variant} aria-label={label} {...rest}>{children}</Button>;
}

export function Checkbox({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} disabled={disabled} className="tl-check-row" onClick={() => onChange(!checked)}>
      <span className="tl-check" data-on={checked || undefined}><svg viewBox="0 0 16 16" aria-hidden><path d="M3.5 8.5l3 3 6-7" /></svg></span>
      {children && <span className="tl-ctl-label">{children}</span>}
    </button>
  );
}

export function Field({ label, error, children, hint }: { label?: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className="tl-field">{label && <label className="tl-field-label">{label}</label>}{children}{error ? <p className="tl-field-err">{error}</p> : hint ? <p className="tl-field-hint">{hint}</p> : null}</div>;
}
export function Input({ leading, clearable, onClear, error, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; clearable?: boolean; onClear?: () => void; error?: boolean }) {
  return (
    <div className={cn("tl-input", className)} data-error={error || undefined}>
      {leading && <span className="tl-input-lead">{leading}</span>}
      <input {...rest} />
      {clearable && `${rest.value ?? ""}`.length > 0 && <button type="button" className="tl-input-clear" aria-label="Clear" onClick={onClear}><X weight="bold" /></button>}
    </div>
  );
}
export function Search(props: InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }) {
  return <Input leading={<MagnifyingGlass weight="regular" />} clearable placeholder="Search" {...props} />;
}
export function Textarea({ error, className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={cn("tl-textarea", className)} data-error={error || undefined} {...rest} />;
}

export function Segmented<T extends string>({ value, onChange, options, size = "md", ariaLabel = "Options" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; size?: "sm" | "md"; ariaLabel?: string }) {
  return <TravellingSelection variant="segmented" size={size} ariaLabel={ariaLabel} value={value} onChange={onChange} items={options.map((o) => ({ value: o.value, label: o.label }))} />;
}

function usePopover(anchorRef: RefObject<HTMLElement>) {
  const [open, setOpen] = useState(false);
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "bottom", align: "start", gap: 6 });
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { const t = e.target as Node; if (floatRef.current?.contains(t) || anchorRef.current?.contains(t)) return; setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); (anchorRef.current as HTMLElement)?.focus?.(); } };
    document.addEventListener("pointerdown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, anchorRef]);
  return { open, setOpen, floatRef, pos };
}

export function Select<T extends string>({ value, onChange, options, placeholder = "Select…" }: { value: T | null; onChange: (v: T) => void; options: { value: T; label: string }[]; placeholder?: string }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { open, setOpen, floatRef, pos } = usePopover(anchorRef);
  const current = options.find((o) => o.value === value);
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); return; }
    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault(); const items = Array.from(floatRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
      const i = items.findIndex((el) => el === document.activeElement);
      items[e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1)]?.focus();
    }
  };
  return (
    <>
      <button ref={anchorRef} type="button" className="tl-select" aria-haspopup="listbox" aria-expanded={open} data-open={open || undefined} onClick={() => setOpen((o) => !o)} onKeyDown={onKey}>
        <span className={cn(!current && "tl-select-ph")}>{current?.label ?? placeholder}</span><CaretDown weight="bold" />
      </button>
      {open && (
        <Portal>
          <div ref={floatRef} className="tl-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600 }}>
            <Frost radius={13} className="tl-menu" role="listbox">
              {options.map((o) => (
                <button key={o.value} role="option" aria-selected={o.value === value} tabIndex={-1} className="tl-menu-item" data-on={o.value === value || undefined}
                  onClick={() => { onChange(o.value); setOpen(false); anchorRef.current?.focus(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(o.value); setOpen(false); anchorRef.current?.focus(); } }}>
                  {o.label}{o.value === value && <Check weight="bold" />}
                </button>
              ))}
            </Frost>
          </div>
        </Portal>
      )}
    </>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function DatePicker({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const { open, setOpen, floatRef, pos } = usePopover(anchorRef);
  const [view, setView] = useState(() => value ?? new Date());
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const sameDay = (d: Date | null, n: number) => !!d && d.getFullYear() === y && d.getMonth() === m && d.getDate() === n;
  const fmt = value ? `${value.getDate()} ${MONTHS[value.getMonth()].slice(0, 3)} ${value.getFullYear()}` : "Choose a date";
  return (
    <>
      <button ref={anchorRef} type="button" className="tl-select tl-datebtn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Calendar weight="regular" /><span className={cn(!value && "tl-select-ph")}>{fmt}</span>
      </button>
      {open && (
        <Portal>
          <div ref={floatRef} className="tl-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600 }}>
            <Frost radius={16} className="tl-cal" role="dialog" aria-label="Choose a date">
              <div className="tl-cal-head">
                <button className="tl-cal-nav" aria-label="Previous month" onClick={() => setView(new Date(y, m - 1, 1))}><CaretLeft weight="bold" /></button>
                <strong>{MONTHS[m]} {y}</strong>
                <button className="tl-cal-nav" aria-label="Next month" onClick={() => setView(new Date(y, m + 1, 1))}><CaretRight weight="bold" /></button>
              </div>
              <div className="tl-cal-grid">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="tl-cal-dow">{d}</span>)}
                {cells.map((n, i) => n === null ? <span key={i} /> : (
                  <button key={i} className="tl-cal-day" data-on={sameDay(value, n) || undefined} onClick={() => { onChange(new Date(y, m, n)); setOpen(false); }}>{n}</button>
                ))}
              </div>
            </Frost>
          </div>
        </Portal>
      )}
    </>
  );
}
