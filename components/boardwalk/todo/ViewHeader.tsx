"use client";

// Shared editorial header for To Do views: kicker, serif title, meta line,
// optional right-side actions. Keeps every view visually consistent.

export function ViewHeader({
  kicker,
  title,
  meta,
  actions,
}: {
  kicker: string;
  title: string;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
      <div>
        <p className="bw-kicker" style={{ margin: "0 0 6px" }}>{kicker}</p>
        <h1 className="bw-display" style={{ fontSize: 27, margin: 0, lineHeight: 1.1 }}>{title}</h1>
        {meta && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--bw-ink-soft)", letterSpacing: "0.02em" }}>{meta}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export function ViewShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ maxWidth: wide ? 1240 : 860, width: "100%", margin: "0 auto", padding: "26px 22px 80px" }}>
      {children}
    </div>
  );
}

export function EmptyNote({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 20px", color: "var(--bw-ink-soft)" }}>
      <div style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 999, background: "var(--bw-paper-sunken)", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "var(--bw-ink-faint)" }}>
        {icon}
      </div>
      <h3 className="bw-display" style={{ fontSize: 18, margin: "0 0 6px" }}>{title}</h3>
      <p className="bw-hint" style={{ margin: 0 }}>{hint}</p>
    </div>
  );
}
