/**
 * The primary claim CTA (both A/B card variants). A plain .claim-btn anchor.
 * (The one-shot "shine" glint was removed 2026-11-24: the primary button is now
 * flat, so its ::after sweep was forced display:none and the glint never painted.)
 */
export function ClaimCtaButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className="claim-btn">
      {children}
    </a>
  );
}
