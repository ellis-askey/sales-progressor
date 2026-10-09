import type { CSSProperties, ReactNode } from "react";

// Mortgage advisor portal — light, mobile-first visual tokens. A distinct deep-
// green accent keeps it visually separate from the solicitor portal's blue.
export const A = {
  bgTop: "#F3F6F4",
  bgBottom: "#EAF0EC",
  card: "#FFFFFF",
  ink: "#15201A",
  muted: "#5B6B63",
  faint: "#8A978F",
  line: "#E2E8E3",
  accent: "#1F7A5A",
  accentSoft: "#E8F3EE",
  amber: "#B4690E",
  amberSoft: "#FBEFDD",
};

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: A.card,
        border: `1px solid ${A.line}`,
        borderRadius: 16,
        padding: 18,
        boxShadow: "0 1px 2px rgba(20,32,26,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: A.faint }}>
      {children}
    </p>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: A.accentSoft, color: A.accent, fontSize: 12.5, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ height: 8, borderRadius: 999, background: A.line, overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", background: A.accent, borderRadius: 999 }} />
    </div>
  );
}

// A small status dot for a mortgage step: filled (done), ring (current), faint (upcoming).
export function StepDot({ status }: { status: "complete" | "current" | "upcoming" }) {
  if (status === "complete") {
    return (
      <span style={{ width: 20, height: 20, borderRadius: 999, background: A.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2.5 6.2 5 8.7 9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    );
  }
  if (status === "current") {
    return <span style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${A.accent}`, background: A.accentSoft, flexShrink: 0 }} />;
  }
  return <span style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${A.line}`, background: "#fff", flexShrink: 0 }} />;
}
