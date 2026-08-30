import Link from "next/link";

// A tinted line-art PNG icon (masked to the tint colour) + title + description +
// a glass button with a coral arrow. Used on the Completions and To-Do empty
// states. The CTA is a link (`href`) or a click handler (`onClick`).

export const SETUP_TINTS = {
  coral: { bg: "rgba(var(--agent-coral-rgb), 0.12)", fg: "var(--agent-coral-deep)" },
  blue:  { bg: "rgba(59,130,246,0.12)",  fg: "#2f74e0" },
  green: { bg: "rgba(16,185,129,0.14)",  fg: "#0f9d6b" },
} as const;

const btnStyle: React.CSSProperties = { textDecoration: "none", width: "100%", justifyContent: "space-between" };

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--agent-coral-deep)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

export function SetupCard({ iconSrc, tint, title, desc, cta, href, onClick }: {
  iconSrc: string;
  tint: keyof typeof SETUP_TINTS;
  title: string;
  desc: string;
  cta: string;
  href?: string;
  onClick?: () => void;
}) {
  const t = SETUP_TINTS[tint];
  const inner = <>{cta}<Arrow /></>;
  return (
    <div className="agent-glass" style={{ padding: "18px 18px 16px", borderRadius: "var(--agent-radius-lg)", display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span aria-hidden style={{
            width: 22, height: 22, display: "block", background: t.fg,
            WebkitMaskImage: `url(${iconSrc})`, maskImage: `url(${iconSrc})`,
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
            WebkitMaskPosition: "center", maskPosition: "center",
            WebkitMaskSize: "contain", maskSize: "contain",
          }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>{title}</p>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{desc}</p>
        </div>
      </div>
      {href ? (
        <Link href={href} className="agent-btn agent-btn-secondary agent-btn-sm" style={btnStyle}>{inner}</Link>
      ) : (
        <button type="button" onClick={onClick} className="agent-btn agent-btn-secondary agent-btn-sm" style={btnStyle}>{inner}</button>
      )}
    </div>
  );
}
