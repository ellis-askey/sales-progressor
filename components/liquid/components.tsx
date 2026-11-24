"use client";
// TSP Liquid Glass — component kit. EXPERIMENTAL forward design system
// (components/liquid/README.md). Prop-driven, reusable, built on the LiquidGlass
// engine + app/styles/liquid-glass.css tokens. All state/behaviour is presentational
// only; consumers own the data and actions.

import { Check } from "@/components/icons/ph";
import {
  useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { LiquidGlass } from "./LiquidGlass";
import { LiquidLens } from "./LiquidLens";
import type { HTMLAttributes } from "react";

/* ── Surfaces ──────────────────────────────────────────────────────────────────
   The slab lens (LiquidLens) is the preferred glass material (founder-approved
   2026-11-02), used SELECTIVELY. `material`:
     "lens"  (default) — slab-optics lens; for hero / card / chrome surfaces.
     "frost" — lighter legacy blur (LiquidGlass); cheaper for denser contexts.
     "solid" — no glass; for dense lists so content stays crisp and cheap. */
export type GlassSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  material?: "lens" | "frost" | "solid";
  radius?: number; tint?: string; strength?: "soft" | "strong"; thickness?: number;
};
function Surface({ material = "lens", radius = 18, tint, strength = "soft", thickness = 1.2, className = "", children, ...rest }: GlassSurfaceProps) {
  if (material === "solid") return <div className={`lg-solid ${className}`} style={{ borderRadius: radius }} {...rest}>{children}</div>;
  if (material === "frost") return <LiquidGlass radius={radius} thickness={14} displace={28} aberration={1} tint={tint} className={className} {...rest}>{children}</LiquidGlass>;
  return <LiquidLens radius={radius} strength={strength} thickness={thickness} tint={tint} className={className} {...rest}>{children}</LiquidLens>;
}
export function GlassPanel(p: GlassSurfaceProps) { return <Surface tint="var(--lg-glass-panel)" {...p} />; }
export function GlassCard(p: GlassSurfaceProps) { return <Surface tint="var(--lg-glass-card)" {...p} />; }

/* ── Buttons ──────────────────────────────────────────────────────────────── */
type BtnVariant = "primary" | "secondary" | "subtle" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";
export function GlassButton({
  variant = "secondary", size = "md", icon = false, full = false, loading = false,
  children, className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; icon?: boolean; full?: boolean; loading?: boolean }) {
  const cls = [
    "lgbtn", `lgbtn--${variant}`,
    size !== "md" ? `lgbtn--${size}` : "",
    icon ? "lgbtn--icon" : "", full ? "lgbtn--full" : "", className,
  ].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="lgspin" /> : children}
    </button>
  );
}
export function Spinner() { return <span className="lgspin" />; }

/* ── Inputs ───────────────────────────────────────────────────────────────── */
export function GlassInput({ leading, error, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; error?: boolean }) {
  return (
    <div className={`lgfield ${className}`} data-error={error || undefined}>
      {leading}
      <input {...rest} />
    </div>
  );
}
export function GlassTextarea({ error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className="lgtextarea" data-error={error || undefined} {...rest} />;
}
export function Field({ label, error, children }: { label?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      {label && <label className="lglabel">{label}</label>}
      {children}
      {error && <p className="lgerror">{error}</p>}
    </div>
  );
}

/* ── Switch ───────────────────────────────────────────────────────────────── */
export function GlassSwitch({ checked, onChange, disabled, ...rest }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">) {
  return (
    <button role="switch" aria-checked={checked} className="lgswitch" disabled={disabled} onClick={() => onChange(!checked)} {...rest}>
      <span className="lgswitch-knob" />
    </button>
  );
}

/* ── Segmented control ────────────────────────────────────────────────────── */
export function GlassSegmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="lgseg" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span className="lgseg-thumb" style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(calc(${idx} * 100%))` }} />
      {options.map((o) => (
        <button key={o.value} className="lgseg-btn" data-on={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────────── */
export function GlassChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="lgchip" aria-pressed={pressed} onClick={onClick}>
      <span className="lgchip-tick"><Check weight="bold" /></span>{children}
    </button>
  );
}

/* ── Slider ───────────────────────────────────────────────────────────────── */
export function GlassSlider({ value, onChange, min = 0, max = 100 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const pct = ((value - min) / (max - min)) * 100;
  return <input type="range" className="lgslider" min={min} max={max} value={value} style={{ ["--v" as string]: `${pct}%` }} onChange={(e) => onChange(+e.target.value)} />;
}

/* ── Checkbox / radio ─────────────────────────────────────────────────────── */
export function GlassCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button className="lgcheck-row" aria-checked={checked} role="checkbox" onClick={() => onChange(!checked)}>
      <span className="lgcheck"><Check weight="bold" /></span>{children}
    </button>
  );
}
export function GlassRadioGroup<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }} role="radiogroup">
      {options.map((o) => (
        <button key={o.value} className="lgradio-row" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          <span className="lgradio" />{o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Badges / status / progress / skeleton ───────────────────────────────── */
export type Tone = "accent" | "ok" | "warn" | "danger" | "neutral";
export function GlassBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className="lgbadge" data-tone={tone}>{children}</span>;
}
export function StatusDot({ tone = "neutral", label }: { tone?: "ok" | "warn" | "info" | "neutral"; label: string }) {
  return <span className="lgstatus"><span className="lgstatus-dot" data-tone={tone} />{label}</span>;
}
export function GlassProgress({ value }: { value: number }) {
  return <div className="lgprog"><span className="lgprog-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
export function Skeleton({ w = "100%", h = 12, r }: { w?: number | string; h?: number | string; r?: number }) {
  return <div className="lgskel" style={{ width: w, height: h, borderRadius: r }} />;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
export function GlassTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string }[] }) {
  const idx = Math.max(0, tabs.findIndex((t) => t.value === value));
  const wid = 100 / tabs.length;
  return (
    <div className="lgtabs" style={{ background: "var(--lg-fill)" }}>
      <span className="lgtab-ink" style={{ left: 4, width: `calc(${wid}% - 8px / ${tabs.length})`, transform: `translateX(calc(${idx} * 100%))` }} />
      {tabs.map((t) => (
        <button key={t.value} className="lgtab" data-on={value === t.value} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  );
}

/* ── Menu / tooltip (content only — anchoring is the consumer's) ──────────── */
export function GlassMenu({ children, radius = 14 }: { children: ReactNode; radius?: number }) {
  return <LiquidLens tint="var(--lg-glass-raised)" radius={radius} strength="strong" thickness={1.4} className="lgmenu">{children}</LiquidLens>;
}
export function GlassMenuItem({ icon, danger, children, onClick }: { icon?: ReactNode; danger?: boolean; children: ReactNode; onClick?: () => void }) {
  return <button className="lgmenu-item" data-danger={danger || undefined} onClick={onClick}>{icon}{children}</button>;
}
export function MenuSep() { return <span className="lgmenu-sep" />; }

/* ── Toast (presentational) ───────────────────────────────────────────────── */
export function GlassToast({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <LiquidLens tint="var(--lg-glass-raised)" radius={13} strength="strong" thickness={1.4} className="lgtoast" role="status">{icon}<span>{children}</span></LiquidLens>;
}

/* ── Dock ─────────────────────────────────────────────────────────────────── */
export function GlassDock({ children, radius = 22 }: { children: ReactNode; radius?: number }) {
  return <LiquidLens tint="var(--lg-glass-raised)" radius={radius} strength="strong" thickness={1.5} className="lgdock">{children}</LiquidLens>;
}
export function DockButton({ icon, children, onClick }: { icon?: ReactNode; children: ReactNode; onClick?: () => void }) {
  return <button className="lgdock-btn" onClick={onClick}>{icon}<span>{children}</span></button>;
}
export function DockSep() { return <span className="lgdock-sep" />; }

/* ── Dialog ───────────────────────────────────────────────────────────────── */
export function GlassDialog({ open, onClose, children, radius = 22 }: { open: boolean; onClose: () => void; children: ReactNode; radius?: number }) {
  if (!open) return null;
  return (
    <div className="lg-ds-overlay" onClick={onClose}>
      <LiquidLens tint="var(--lg-glass-raised)" radius={radius} strength="strong" thickness={1.5} className="lgdialog" onClick={(e) => e.stopPropagation()}>
        {children}
      </LiquidLens>
    </div>
  );
}

/* ── Nav rail ─────────────────────────────────────────────────────────────── */
export function NavRail({ children }: { children: ReactNode }) {
  return <LiquidLens tint="var(--lg-glass-panel)" radius={18} strength="soft" thickness={1.1} className="lgnav">{children}</LiquidLens>;
}
export function NavItem({ icon, active, children, onClick }: { icon?: ReactNode; active?: boolean; children: ReactNode; onClick?: () => void }) {
  return <button className="lgnav-item" data-on={active || undefined} onClick={onClick}>{icon}<span>{children}</span></button>;
}

/* A tiny unique-id helper so consumers can label controls accessibly. */
export function useFieldId(prefix = "lg") { return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`; }
