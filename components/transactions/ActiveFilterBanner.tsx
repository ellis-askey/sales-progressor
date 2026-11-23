import Link from "next/link";
import { X } from "@phosphor-icons/react";

// The active-filter banner shown above the file list when a hub / month filter
// narrows the book (e.g. "Exchanging this week · 3 files"). One component for
// both, with the × Clear-filter escape hatch. Border-only (no wash) per the
// de-tint rule; inline-styled so it doesn't depend on the (bugged) .tl-filter-banner
// CSS. Extracted at the 2026-11-23 All Files pass.
export function ActiveFilterBanner({
  label,
  count,
  clearHref,
}: {
  label: string;
  count: number;
  clearHref: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "0.5px solid rgba(var(--agent-coral-rgb), 0.28)" }}>
      <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", flex: 1 }}>
        <strong style={{ color: "var(--agent-text-primary)", fontWeight: 600 }}>{label}</strong>
        <span style={{ color: "var(--agent-text-muted)", marginLeft: 6 }}>· {count} {count === 1 ? "file" : "files"}</span>
      </span>
      <Link href={clearHref} className="agent-link agent-link-muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <X size={11} /> Clear filter
      </Link>
    </div>
  );
}
