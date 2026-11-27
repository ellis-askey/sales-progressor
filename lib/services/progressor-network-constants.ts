// Client-safe controlled vocabularies for the Progressor Network — the single
// source of truth for the filter facets AND the per-business profile picker, so
// chips never drift. A business's networkSpecialisms / networkRegions store a
// subset of these. Pure data (no server imports), so client components can use
// it directly without dragging the server service (prisma / session / next
// headers) into the client bundle. Extend in ONE place (here).

export const NETWORK_SPECIALISMS = [
  "Leasehold",
  "New-build",
  "Chain management",
  "High-value",
  "First-time buyers",
  "Shared ownership",
  "Auction sales",
  "Probate / executor sales",
] as const;

export const NETWORK_REGIONS = [
  "Nationwide",
  "London",
  "South East",
  "South West",
  "Midlands",
  "North",
  "Scotland",
  "Wales",
] as const;
