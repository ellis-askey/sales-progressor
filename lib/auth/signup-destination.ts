// Signup destination decision (Fix 8): should this email create a NEW agency, or
// be routed as a request to join an EXISTING agency?
//
// Matches the email's domain against agencies that have VERIFIED their own domain
// (DKIM/SPF via SendGrid). Generic mailboxes (gmail/outlook) never match, so a
// join-request only triggers on a strong custom-domain signal. Ambiguous matches
// (the same domain verified by >1 agency — rare, uniqueness is per-agency) fall
// back to new-agency so we never route to the wrong tenant.
//
// Gated by SIGNUP_JOIN_REQUESTS_ENABLED (default off) so the whole feature can
// ship dark and be switched on deliberately.

import { prisma } from "@/lib/prisma";

export function joinRequestsEnabled(): boolean {
  return process.env.SIGNUP_JOIN_REQUESTS_ENABLED === "true";
}

export type SignupDestination =
  | { kind: "new_agency" }
  | { kind: "join_request"; agencyId: string; agencyName: string };

export async function resolveSignupDestination(email: string): Promise<SignupDestination> {
  if (!joinRequestsEnabled()) return { kind: "new_agency" };
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return { kind: "new_agency" };

  const matches = await prisma.verifiedDomain.findMany({
    where: { domain, status: "verified" },
    select: { agencyId: true, agency: { select: { name: true } } },
  });
  // 0 = normal signup; >1 = ambiguous, never guess.
  if (matches.length !== 1) return { kind: "new_agency" };
  return { kind: "join_request", agencyId: matches[0].agencyId, agencyName: matches[0].agency.name };
}
