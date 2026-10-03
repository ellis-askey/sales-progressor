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

// Founder test accounts allowed to use the Critique launcher WITHOUT being
// superadmin — so the external sales-progression business and its client agency
// can be critiqued live from their own production logins. Grants ONLY the critique
// note/screenshot capability (no other command-centre access). TEMPORARY: remove
// these two entries once the production test round is done.
export const CRITIQUE_TESTER_EMAILS: ReadonlyArray<string> = [
  "ellisaskey+testprog@googlemail.com",
  "ellisaskey+testclient@googlemail.com",
];

export function isCritiqueTesterEmail(email: string | null | undefined): boolean {
  return email != null && CRITIQUE_TESTER_EMAILS.includes(email.toLowerCase());
}
