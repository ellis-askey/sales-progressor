// Internal-staff Focus page (Sales Progressor's own team + founder/admin). Two
// columns: LEFT the merged client-communications cockpit — the weekly touch
// quota, enriched with what's actually reached each client and their
// delivery/open status; RIGHT the enquiries + searches rail. Each viewer's feeds
// are scoped to their own book. Agency users 404. Never cached — ordering is by
// live contact recency.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveInternalVisibility, resolveAgentVisibility } from "@/lib/services/agent";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { getFocusLeft, getFocusRight } from "@/lib/services/focus";
import { FocusClientComms, type FocusCommsFile } from "@/components/focus/FocusClientComms";
import { FocusRightRail } from "@/components/focus/FocusRightRail";
import { BloomStage } from "@/components/agent/BloomStage";

export const metadata = { title: "Focus" };
export const dynamic = "force-dynamic";

export default async function FocusPage() {
  const session = await requireSession();

  const role = session.user.role;
  // Internal staff surface: Sales Progressor's own team (sales_progressor) plus
  // founder/admin tiers. Each sees their own book via the scoped feeds below.
  const isInternal = role === "sales_progressor" || role === "admin" || role === "superadmin";
  if (!isInternal) notFound();
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
    <BloomStage className="focus-page">
      <style>{`
        /* Sits where every other agent page sits: full width, ~32px side padding,
           8px off the top (matches the enquiries/hub content pad). The header
           (title, subtext, progress bar) spans the full width across the top; the
           dominant communications list (1fr) and the fixed-width right rail sit in
           the row beneath, so the rail's first card lines up with the first file. */
        .focus-page { display: grid; gap: 22px; grid-template-columns: minmax(0, 1fr); padding: 24px 16px 48px; }
        @media (min-width: 900px) { .focus-page { padding: 24px 32px 48px; } }
        /* Two columns from iPad landscape up; below this everything stacks in a
           single column (header, tabs + list, then the rail). */
        @media (min-width: 1000px) {
          .focus-page {
            grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
            grid-template-areas: "header header" "list rail";
            align-items: start;
            column-gap: 24px;
            row-gap: 0;
          }
          .focus-page > .fr { grid-area: rail; }
        }
      `}</style>
      <FocusClientComms files={leftFiles} totalSides={left.totalSides} doneSides={left.doneSides} showWhatsApp={left.whatsappInUse} needsYou={Object.fromEntries(right.needsYou.map((n) => [n.transactionId, n.reason]))} />
      <FocusRightRail
        enquiries={right.enquiries}
        openEnquiryCount={right.openEnquiryCount}
        searches={right.searches}
        searchCount={right.searchCount}
      />
    </BloomStage>
  );
}
