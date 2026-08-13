import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";

// Internal email-preview / disposable mockup pages (audit #4). Same gate as
// the /agent/polish and /agent/audit trees: a 404 for everyone except the
// founder, so no customer (logged in or not) can reach a raw internal
// preview, while it stays available to us for building. Covers every current
// and future page under /test/* in one place.
//
// Allowlist is the shared edge-safe list (lib/security/hybrid-emails.ts) —
// currently just ellis@thesalesprogressor.co.uk.
export default async function TestLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!isHybridSuperadminEmail(session.user.email)) notFound();
  return <>{children}</>;
}
