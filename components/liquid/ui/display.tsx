"use client";
// Forward Liquid-Glass UI — display primitives (EmptyState, Pill, Disclosure, Thumb).
import { House } from "@/components/icons/ph";
import { cn } from "./primitives";
import type { ReactNode } from "react";

export function EmptyState({ icon, title, body, cta }: { icon?: ReactNode; title: string; body?: string; cta?: ReactNode }) {
  return (
    <div className="glu-empty">
      <span className="glu-empty-ic">{icon ?? <House weight="regular" />}</span>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {cta}
    </div>
  );
}
export function Pill({ tone = "neutral", children }: { tone?: "warn" | "info" | "coral" | "neutral"; children: ReactNode }) {
  return <span className={cn("glu-pill", `glu-pill-${tone}`)}>{children}</span>;
}
export function Disclosure({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return <button className="glu-disclosure" aria-expanded={open} onClick={onToggle}><span className={cn("glu-caret", open && "open")}>›</span> {children}</button>;
}
export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return <div className={cn("glu-skel", className)}>{Array.from({ length: lines }).map((_, i) => <span key={i} className="glu-skel-line" style={{ width: `${92 - i * 13}%` }} />)}</div>;
}
export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="glu-spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}
export function PropertyThumb({ url, size = 42 }: { url?: string | null; size?: number }) {
  return url
    // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL; next/image remote config out of scope here
    ? <img src={url} alt="" width={size} height={size} className="glu-thumb" style={{ width: size, height: size }} />
    : <span className="glu-thumb glu-thumb--ph" style={{ width: size, height: size }}><House size={size * 0.4} weight="regular" /></span>;
}
