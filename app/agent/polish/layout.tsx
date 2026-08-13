import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";

// Internal preview / polish mockups (audit #4). These are half-built demo
// pages with mock data — some literally error harmlessly when clicked — so
// no customer should ever land on one. This gate makes the whole tree
// invisible (a 404) to everyone except the founder, while keeping it
// available to us for building. Covers every current and future page under
// /agent/polish/* without touching each one.
//
// The email allowlist is the same edge-safe list the Command Centre uses
// (lib/security/hybrid-emails.ts) — currently just ellis@thesalesprogressor.co.uk.
export default async function PolishLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!isHybridSuperadminEmail(session.user.email)) notFound();
  return <>{children}</>;
}
