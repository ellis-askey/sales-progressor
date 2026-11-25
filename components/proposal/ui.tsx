"use client";

import { useEffect, useId, useRef, useState } from "react";
import { gbp, num } from "@/lib/proposal/model";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ─── Eyebrow + section head ──────────────────────────────────────────────────

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="prop-eyebrow">{children}</p>;
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  titleClass,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  titleClass?: string;
}) {
  return (
    <header className="prop-section-head">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className={cx("prop-h1", titleClass)}>{title}</h2>
      {lead && <p className="prop-lead prop-measure">{lead}</p>}
    </header>
  );
}

// ─── Stat ────────────────────────────────────────────────────────────────────

export function Stat({
  value,
  label,
  coral,
  sub,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  coral?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <div className={cx("prop-stat-value", coral && "prop-stat-value--coral")}>{value}</div>
      <div className="prop-stat-label">{label}</div>
      {sub && <div className="prop-caption" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Chip ────────────────────────────────────────────────────────────────────

export function Chip({
  children,
  tone,
  dot,
}: {
  children: React.ReactNode;
  tone?: "coral" | "live";
  dot?: boolean;
}) {
  return (
    <span className={cx("prop-chip", tone === "coral" && "prop-chip--coral", tone === "live" && "prop-chip--live", dot && "prop-chip--dot")}>
      {children}
    </span>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "onnavy";
  size?: "md" | "sm";
  loading?: boolean;
};

export function PButton({ variant = "primary", size = "md", loading, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cx("prop-btn", `prop-btn--${variant}`, size === "sm" && "prop-btn--sm", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="prop-btn-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ─── Reveal on scroll ────────────────────────────────────────────────────────

export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx("prop-reveal", shown && "is-in", className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

// ─── Slider ──────────────────────────────────────────────────────────────────

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  suffix?: string;
}) {
  const pctFilled = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const display = format ? format(value) : `${num(value)}${suffix ?? ""}`;
  return (
    <div>
      <div className="prop-field-row">
        <label className="prop-field-label">{label}</label>
        <span className="prop-field-value">{display}</span>
      </div>
      <input
        className="prop-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={display}
        style={{
          ["--prop-track" as string]: `linear-gradient(90deg, var(--prop-coral) ${pctFilled}%, var(--prop-line-strong) ${pctFilled}%)`,
        }}
      />
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

export function Stepper({
  value,
  min = 0,
  max = Infinity,
  step = 1,
  onChange,
  ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="prop-stepper">
      <button type="button" aria-label={`Decrease ${ariaLabel}`} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <input
        type="number"
        aria-label={ariaLabel}
        value={value}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
      />
      <button type="button" aria-label={`Increase ${ariaLabel}`} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="prop-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="prop-seg-btn"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Preset chips ────────────────────────────────────────────────────────────

export function PresetRow<T extends number | string>({
  options,
  value,
  onChange,
  format,
  label,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  label?: string;
}) {
  return (
    <div>
      {label && <div className="prop-field-label" style={{ marginBottom: 8 }}>{label}</div>}
      <div className="prop-flex-wrap">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            className="prop-seg-btn"
            data-active={value === o}
            style={
              value === o
                ? { background: "var(--prop-coral)", color: "#fff", border: "1px solid var(--prop-coral)" }
                : { border: "1px solid var(--prop-line-strong)" }
            }
            onClick={() => onChange(o)}
          >
            {format ? format(o) : String(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Disclosure (accordion) ──────────────────────────────────────────────────

export function Disclosure({
  title,
  children,
  defaultOpen = false,
  onOpen,
  meta,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpen?: () => void;
  meta?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const firedRef = useRef(false);
  const id = useId();
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !firedRef.current) {
      firedRef.current = true;
      onOpen?.();
    }
  };
  return (
    <div className="prop-disc" data-open={open}>
      <button type="button" className="prop-disc-head" aria-expanded={open} aria-controls={id} onClick={toggle}>
        <span className="prop-disc-title">{title}</span>
        <span className="prop-flex" style={{ alignItems: "center" }}>
          {meta}
          <Caret />
        </span>
      </button>
      <div className="prop-disc-body" id={id} role="region">
        <div>
          <div className="prop-disc-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Caret() {
  return (
    <svg className="prop-disc-caret" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="prop-drawer-backdrop" onClick={onClose} aria-hidden />
      <aside className="prop-drawer" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Panel"}>
        <div className="prop-drawer-head">
          <h3 className="prop-h3">{title}</h3>
          <button className="prop-iconbtn" aria-label="Close panel" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="prop-drawer-body">{children}</div>
        {footer && <div className="prop-drawer-head" style={{ borderTop: "1px solid var(--prop-line)", borderBottom: 0 }}>{footer}</div>}
      </aside>
    </>
  );
}

// ─── Bar row ─────────────────────────────────────────────────────────────────

export function BarRow({
  label,
  value,
  max,
  display,
  highlight,
  navy,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  display: string;
  highlight?: boolean;
  navy?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="prop-stack-sm">
      <div className="prop-between">
        <span className="prop-field-label">{label}</span>
        <span className="prop-field-value">{display}</span>
      </div>
      <div className="prop-bar-track">
        <div
          className={cx("prop-bar-fill", !highlight && navy && "prop-bar-fill--navy")}
          style={{ width: `${pct}%`, background: highlight ? "var(--prop-coral)" : navy ? "var(--prop-ink-3)" : undefined }}
        />
      </div>
    </div>
  );
}

// ─── Donut ───────────────────────────────────────────────────────────────────

export function Donut({
  segments,
  size = 168,
  thickness = 22,
  centerLabel,
  centerSub,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Revenue composition">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--prop-line)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * c;
          const circle = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return circle;
        })}
      </g>
      {centerLabel && (
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.15} fontWeight={700} fill="var(--prop-ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.07} fill="var(--prop-ink-3)">
          {centerSub}
        </text>
      )}
    </svg>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="prop-stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((it) => (
        <li key={it.label} className="prop-between" style={{ alignItems: "center" }}>
          <span className="prop-flex" style={{ alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flexShrink: 0 }} />
            <span className="prop-caption" style={{ color: "var(--prop-ink-2)" }}>{it.label}</span>
          </span>
          {it.value && <span className="prop-field-value" style={{ fontSize: "0.8125rem" }}>{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

// ─── Reset button ────────────────────────────────────────────────────────────

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="prop-btn prop-btn--ghost prop-btn--sm" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M13 8a5 5 0 1 1-1.46-3.54M13 3v2.5h-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Reset
    </button>
  );
}

// ─── Assumption note ─────────────────────────────────────────────────────────

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="prop-fnote" style={{ marginTop: "1rem" }}>{children}</p>;
}

// ─── Result readout tile ─────────────────────────────────────────────────────

export function Readout({
  label,
  value,
  coral,
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  coral?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <div className="prop-card prop-card--quiet">
      <div className="prop-stat-label" style={{ marginTop: 0, marginBottom: 6 }}>{label}</div>
      <div className={cx("prop-stat-value", coral && "prop-stat-value--coral")} style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)" }}>
        {value}
      </div>
      {hint && <div className="prop-caption" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

// Re-export formatting for convenience in sections.
export { gbp, num } from "@/lib/proposal/model";
