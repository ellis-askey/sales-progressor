// Edge-safe email allowlists for hybrid users.
//
// Lives in its own file (no Node imports) so the Next.js middleware can read
// it without dragging in @/lib/prisma, @/lib/session, etc. The richer helpers
// at lib/agent-session.ts re-export from here.
//
// Keep both sets tiny — they are the "exception" mechanism, not a policy.

export const HYBRID_ADMIN_EMAILS: ReadonlyArray<string> = [
  "ellis@thesalesprogressor.co.uk",
];

export const HYBRID_SUPERADMIN_EMAILS: ReadonlyArray<string> = [
  "ellis@thesalesprogressor.co.uk",
];

export function isHybridAdminEmail(email: string | null | undefined): boolean {
  return email != null && HYBRID_ADMIN_EMAILS.includes(email);
}

export function isHybridSuperadminEmail(email: string | null | undefined): boolean {
  return email != null && HYBRID_SUPERADMIN_EMAILS.includes(email);
}
