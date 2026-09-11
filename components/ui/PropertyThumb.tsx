// Shared property thumbnail: the file's photo when it has one, the universal
// property-photo placeholder (coral line-art house, light/dark) otherwise —
// never an empty box. Sits to the LEFT of a property address. Size to the
// address block — ~44px when the address wraps to two lines, ~30px when it's a
// single line. Photos are signed upstream via getSignedUrlMap
// (lib/supabase-storage.ts) and passed in as photoUrl. The placeholder art +
// its light/dark switch live in the .property-photo-fallback class (globals.css).
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
      className="property-photo-fallback"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: "inline-block",
        flexShrink: 0,
        border: "0.5px solid rgba(15,23,42,0.08)",
      }}
    />
  );
}
