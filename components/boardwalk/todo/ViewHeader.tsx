"use client";

// Shared view scaffolding for To Do — second-pass: compact headers, content
// starts high, consistent widths, a toolbar slot, and restrained empty notes.

export function ViewHeader({
  kicker,
  title,
  meta,
  actions,
}: {
  kicker?: string;
  title: string;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
        <h1 className="bw-display" style={{ fontSize: 21, margin: 0, lineHeight: 1.15, whiteSpace: "nowrap" }}>{title}</h1>
        {meta && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--bw-ink-soft)", letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meta}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export function ViewShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ maxWidth: wide ? 1240 : 820, width: "100%", margin: "0 auto", padding: "18px 22px 70px" }}>
      {children}
    </div>
  );
}

export function EmptyNote({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 18px",
        border: "1px dashed var(--bw-line-strong)",
        borderRadius: 14,
        margin: "14px 0",
        background: "var(--bw-paper-raised)",
      }}
    >
      <span style={{ display: "inline-flex", width: 38, height: 38, borderRadius: 999, background: "var(--bw-paper-sunken)", alignItems: "center", justifyContent: "center", color: "var(--bw-ink-faint)", flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 650, margin: 0, color: "var(--bw-ink-strong)" }}>{title}</p>
        <p className="bw-hint" style={{ margin: "1px 0 0" }}>{hint}</p>
      </div>
      {action}
    </div>
  );
}
