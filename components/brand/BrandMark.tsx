// The Sales Progressor brand icon (the coral "C" mark). One source of truth so
// the login, forgot-password and invite pages all render the same, correct logo.
// The asset is already a circle, so no radius/crop is needed.
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-icon.png"
      alt="Sales Progressor"
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size }}
    />
  );
}
