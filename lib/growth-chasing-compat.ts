// Backward-compatibility mapping for the legacy /command/enquiries-chase URL.
//
// PREPARED in Growth consolidation Phase 4 — NOT wired into next.config yet.
// Redirect ACTIVATION belongs to Phase 5A (together with the rest of the Growth
// legacy redirects + the sidebar collapse). This module is inert until then.
//
// The legacy page used ?tab=<enquiries|solicitor|client|opted_out> for its four
// sub-views. The workspace uses ?tab=experiments&view=chasing with the sub-view
// in ?chase=<value>. The legacy ?tab value therefore must NOT leak into the
// workspace top-level ?tab (which selects the Growth tab). This pure function is
// the reference the Phase-5A config redirect must reproduce — a `has` condition
// that captures the legacy `tab` query and maps it to `chase`, which also
// *consumes* `tab` so Next does not re-forward it onto the destination.
//
// Note this is a static reference/oracle for the mapping, not the runtime: Next
// config redirects are a static array, so Phase 5A encodes the equivalent `has`
// entries (documented in 07-GROWTH-CONSOLIDATION.md §11d). What still needs
// RUNTIME verification is that those `has` entries, in a running Next app,
// produce exactly the URLs this function returns.

export const LEGACY_CHASE_VALUES = ["enquiries", "solicitor", "client", "opted_out"] as const;
export type LegacyChaseValue = (typeof LEGACY_CHASE_VALUES)[number];

// Workspace-reserved params must never be overwritten by a forwarded legacy
// param (the legacy page never carried these, but we guard anyway).
const RESERVED = new Set(["tab", "view", "chase"]);

/**
 * Map a legacy /command/enquiries-chase query to the canonical workspace URL.
 * Mirrors the Chasing sub-nav exactly: the default (enquiries) carries no
 * `chase`, the other three carry `chase=<value>`. The result ALWAYS has
 * `tab=experiments` — the legacy `tab` value can never overwrite it. Any
 * genuinely unrelated query params are forwarded unchanged.
 */
export function mapLegacyChaseUrl(query: Record<string, string | undefined> = {}): string {
  const raw = query.tab;
  const chase: LegacyChaseValue =
    raw === "solicitor" || raw === "client" || raw === "opted_out" ? raw : "enquiries";

  const params = new URLSearchParams();
  params.set("tab", "experiments");
  params.set("view", "chasing");
  if (chase !== "enquiries") params.set("chase", chase);

  // Forward unrelated params only; the legacy `tab` is consumed, and the
  // reserved workspace params are never clobbered.
  for (const [k, v] of Object.entries(query)) {
    if (RESERVED.has(k) || v == null) continue;
    params.set(k, v);
  }

  return `/command/growth?${params.toString()}`;
}
