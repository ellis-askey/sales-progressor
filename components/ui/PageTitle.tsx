import type { CSSProperties, ReactNode } from "react";

/**
 * Page title — the canonical auth/page heading: a 28px semibold title with a
 * coral accent stop (the brand's "Welcome back." treatment), over an optional
 * muted subtitle. A trailing full stop in `title` is rendered in the accent
 * colour; titles without one get no accent. Inherits text-alignment from its
 * parent, so the caller centres (login) or left-aligns (a form card) as it likes.
 *
 * Defaults to the WARM sign-in palette (#2D1810 ink). The invite/claim pages run
 * a COOLER palette, so they pass `color="#20242E"` / `subtitleColor="#3F3F46"`
 * to keep the heading matched to their body text. The coral stop (#FF6B4A) is
 * shared and matches both --claim-coral and the brand coral, so it rarely needs
 * overriding.
 */
export function PageTitle({
  title,
  subtitle,
  style,
  color = "#2D1810",
  subtitleColor = "rgba(45,24,16,0.55)",
  accentColor = "#FF6B4A",
}: {
  title: string;
  subtitle?: ReactNode;
  style?: CSSProperties;
  /** Heading ink. Defaults to the warm sign-in colour; claim pages pass #20242E. */
  color?: string;
  /** Subtitle ink. Defaults warm; claim pages pass #3F3F46. */
  subtitleColor?: string;
  /** The trailing-stop accent. Defaults to brand coral. */
  accentColor?: string;
}) {
  const hasStop = title.endsWith(".");
  const base = hasStop ? title.slice(0, -1) : title;
  return (
    <div style={style}>
      <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, color, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
        {base}
        {hasStop && <span style={{ color: accentColor }}>.</span>}
      </h1>
      {subtitle && (
        <p style={{ margin: "0.45rem 0 0", fontSize: "13px", color: subtitleColor, lineHeight: 1.5 }}>{subtitle}</p>
      )}
    </div>
  );
}
