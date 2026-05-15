import type React from "react";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="agent-page-header">
      <div className="agent-page-header-text">
        <h1 style={{
          margin: "0 0 4px", fontSize: "var(--agent-text-h2)", fontWeight: 600,
          color: "var(--agent-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2,
        }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>
          {subtitle}
        </p>
      </div>
      {children && (
        <div className="agent-page-header-actions">
          {children}
        </div>
      )}
    </div>
  );
}
