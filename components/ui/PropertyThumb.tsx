import { HouseSimple } from "@phosphor-icons/react";

// Shared property thumbnail: the file's photo when it has one, a neutral
// house glyph otherwise (never an empty box). Sits to the LEFT of a property
// address. Size to the address block — ~44px when the address wraps to two
// lines, ~30px when it's a single line. Photos are signed upstream via
// getSignedUrlMap (lib/supabase-storage.ts) and passed in as photoUrl.
export function PropertyThumb({
  photoUrl,
  size = 44,
}: {
  photoUrl?: string | null;
  size?: number;
}) {
  const radius = Math.max(6, Math.round(size * 0.22));
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
          border: "0.5px solid rgba(15,23,42,0.08)",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--agent-surface-glass, rgba(15,23,42,0.05))",
        color: "var(--agent-text-muted, rgba(15,23,42,0.40))",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: "0.5px solid rgba(15,23,42,0.08)",
      }}
    >
      <HouseSimple size={Math.round(size * 0.46)} weight="regular" />
    </span>
  );
}
