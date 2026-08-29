import { P } from "@/components/portal/portal-ui";

// The empty "add" avatar for every "Your team" add-card (onward agent, selling
// agent, broker). A filled gradient disc with a centred plus — the same
// P.heroGradient the filled avatars use, so an empty slot already reads as a
// person's place and re-themes with them (chosen 2026-08-29, option C). The plus
// is an SVG so it's dead-centre and crisp at any size.
export function PortalAddSlot({ size = 46 }: { size?: number }) {
  const icon = Math.round(size * 0.41);
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: P.heroGradient,
        color: "#fff",
        boxShadow: "0 3px 10px rgba(255,107,74,0.34)",
      }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </div>
  );
}
