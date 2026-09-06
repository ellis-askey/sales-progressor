// Claim-card A/B experiment (2026-09-06).
//
// Two designs for the chain-invite landing page (/claim):
//   A = the original coral hero card (control)
//   B = the light illustrated card with avatar, photos, pills (challenger)
//
// Assignment is a FROZEN deterministic hash of the ChainLink id, so:
//   - the same invite always renders the same variant (stable per visitor), and
//   - the results page can recompute the exact same bucket with no stored column.
//
// DO NOT change hashLinkId or the `% 2` split once real data exists — doing so
// re-buckets historical invites and corrupts the experiment. Retire the whole
// experiment instead (pick a winner, drop the branch).

export type ClaimVariant = "A" | "B";

// FNV-1a (32-bit). Stable, uniform, dependency-free — good enough for a coin flip.
function hashLinkId(linkId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < linkId.length; i++) {
    h ^= linkId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 50/50 assignment for an invite link. */
export function claimVariantFor(linkId: string): ClaimVariant {
  return hashLinkId(linkId) % 2 === 0 ? "A" : "B";
}

/** Parse a `?variant=a|b` preview override. Returns null for anything else. */
export function parseVariantOverride(raw: string | undefined): ClaimVariant | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  return v === "A" || v === "B" ? v : null;
}
