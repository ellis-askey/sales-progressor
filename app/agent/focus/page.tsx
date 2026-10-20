// Founder-only Focus page. Two columns: LEFT (65%) the merged client-
// communications cockpit — the weekly touch quota, enriched with what's actually
// reached each client and their delivery/open status; RIGHT (35%) the enquiries +
// searches rail. Gated to the founder; anyone else 404s. Never cached — ordering
// is by live contact recency.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveInternalVisibility, resolveAgentVisibility } from "@/lib/services/agent";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { getFocusLeft, getFocusRight } from "@/lib/services/focus";
import { FocusClientComms, type FocusCommsFile } from "@/components/focus/FocusClientComms";
import { FocusRightRail } from "@/components/focus/FocusRightRail";

export const metadata = { title: "Focus" };
export const dynamic = "force-dynamic";

const FOUNDER_EMAIL = "ellis@thesalesprogressor.co.uk";

export default async function FocusPage() {
  const session = await requireSession();
  if (session.user.email !== FOUNDER_EMAIL) notFound();

  const role = session.user.role;
  const isInternal = role === "sales_progressor" || role === "admin" || role === "superadmin";
  const vis = isInternal
    ? resolveInternalVisibility(session.user.id, role, hasAdminPowers(session), session.user.progressionBusinessId, session.user.progressionBusinessRole, session.user.canViewAllFiles)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const scope = getAccessScope(session);

  const [left, right] = await Promise.all([getFocusLeft(vis), getFocusRight(scope, vis)]);

  const photos = await getSignedUrlMap(
    left.files.map((f) => f.photoStoragePath).filter((p): p is string => !!p),
  );
  const leftFiles: FocusCommsFile[] = left.files.map((f) => ({
    transactionId: f.transactionId,
    addressLine: f.addressLine,
    townPostcode: f.townPostcode,
    sides: f.sides,
    anyQuiet: f.anyQuiet,
    photoUrl: f.photoStoragePath ? photos.get(f.photoStoragePath) ?? null : null,
  }));

  return (
    <div className="focus-page">
      <style>{`
        /* Sits where every other agent page sits: full width, ~32px side padding,
           8px off the top (matches the enquiries/hub content pad). The left
           communications column is dominant (1fr); the right rail is a tidy
           fixed-width sidebar, not a 35%-of-everything slab. */
        .focus-page { display: grid; gap: 22px; grid-template-columns: minmax(0, 1fr); padding: 8px 16px 48px; }
        @media (min-width: 900px) { .focus-page { padding: 8px 32px 48px; } }
        @media (min-width: 1080px) {
          .focus-page { grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); align-items: start; }
        }
      `}</style>
      <FocusClientComms files={leftFiles} totalSides={left.totalSides} doneSides={left.doneSides} />
      <FocusRightRail
        enquiries={right.enquiries}
        openEnquiryCount={right.openEnquiryCount}
        searches={right.searches}
        searchCount={right.searchCount}
      />
    </div>
  );
}
