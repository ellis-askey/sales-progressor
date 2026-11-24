import type { ReactNode } from "react";

// Canonical form section header — an outline icon, a bold title with an optional
// inline "(optional)" note, an optional one-line description beneath, and an
// optional trailing badge (e.g. a "Private" lock chip). Token-based, so it reads
// correctly in light and dark.
//
// Extracted from AddNodeDrawer's local SectionHeader (2026-11-23). Use it to
// lead each section of a drawer/modal form. See
// docs/reference/COMPONENT_LIBRARY_CATALOG.md.
export function FormSectionHeader({
  icon,
  title,
  note,
  description,
  badge,
}: {
  icon: ReactNode;
  title: string;
  // Inline, parenthesised note next to the title (e.g. "optional").
  note?: string;
  description?: string;
  // Trailing element beside the title (e.g. a Private lock chip).
  badge?: ReactNode;
}) {
  return (
    <div className={`flex gap-3 mb-3 ${description ? "items-start" : "items-center"}`}>
      <span className={`shrink-0${description ? " mt-0.5" : ""}`} style={{ color: "var(--agent-text-secondary)" }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold leading-tight" style={{ color: "var(--agent-text-primary)" }}>
            {title}
            {note && (
              <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--agent-text-muted)" }}>
                ({note})
              </span>
            )}
          </h3>
          {badge}
        </div>
        {description && (
          <p className="text-xs leading-relaxed mt-1" style={{ color: "var(--agent-text-muted)" }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
