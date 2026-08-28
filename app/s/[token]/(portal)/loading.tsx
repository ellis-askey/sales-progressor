import { S } from "../ui";

// Shown inside the shell's <main> while a tab's data loads. The chrome (top bar,
// greeting, bottom nav) stays put; only the card stack shows placeholders. The
// shimmer uses .portal-shimmer, which the global reduced-motion rule stills.
export default function SolicitorTabLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-busy="true" aria-label="Loading">
      <SkeletonCard height={132} />
      <SkeletonCard height={92} />
      <SkeletonCard height={168} />
    </div>
  );
}

function SkeletonCard({ height }: { height: number }) {
  return (
    <div
      style={{
        background: S.cardFrostBg,
        backdropFilter: S.cardFrostBlur,
        WebkitBackdropFilter: S.cardFrostBlur,
        border: `1px solid ${S.cardFrostBorder}`,
        borderRadius: 16,
        boxShadow: S.cardShadow,
        padding: 18,
      }}
    >
      <div className="portal-shimmer" style={{ height: 12, width: "38%", borderRadius: 6, marginBottom: 14 }} />
      <div className="portal-shimmer" style={{ height: height - 60, borderRadius: 10 }} />
    </div>
  );
}
