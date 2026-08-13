import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";

// Internal audit / before-after mockups (audit #4). Same treatment as the
// polish tree: the whole /agent/audit/* area is a 404 for anyone except the
// founder, so a signed-in customer can never reach a half-built internal
// page, while it stays available to us for building.
//
// The email allowlist is the same edge-safe list the Command Centre uses
// (lib/security/hybrid-emails.ts) — currently just ellis@thesalesprogressor.co.uk.
export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!isHybridSuperadminEmail(session.user.email)) notFound();
  return <>{children}</>;
}
