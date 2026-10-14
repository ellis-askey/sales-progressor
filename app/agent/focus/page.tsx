// Founder-only "what to work on next" cockpit (critiques #12 + #29).
// Gated to the founder's account; anyone else 404s. Always fresh — the ordering
// is by last human contact, so it must not be cached.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getNextFiles } from "@/lib/services/next-files";
import { FilesCockpit } from "@/components/next/FilesCockpit";
import { getWeeklyTouch } from "@/lib/services/hub";
import { resolveInternalVisibility, resolveAgentVisibility } from "@/lib/services/agent";
import { hasAdminPowers } from "@/lib/agent-session";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { WeeklyTouchCard, type WeeklyTouchFileView } from "@/components/todos/WeeklyTouchCard";

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

  // Weekly "touch every file" (moved here from To-Do, critique #261) — both sides
  // of every active file, quiet ones first.
  const [data, weekly] = await Promise.all([getNextFiles(session), getWeeklyTouch(vis)]);
  const weeklyPhotos = await getSignedUrlMap(
    weekly.files.map((f) => f.photoStoragePath).filter((p): p is string => !!p),
  );
  const weeklyFiles: WeeklyTouchFileView[] = weekly.files.map((f) => ({
    transactionId: f.transactionId,
    addressLine: f.addressLine,
    townPostcode: f.townPostcode,
    sides: f.sides,
    anyQuiet: f.anyQuiet,
    photoUrl: f.photoStoragePath ? weeklyPhotos.get(f.photoStoragePath) ?? null : null,
  }));

  return (
    <>
      <FilesCockpit initialFiles={data.files} />
      {weekly.totalSides > 0 && (
        <div style={{ padding: "0 clamp(16px, 4vw, 32px) 32px" }}>
          <WeeklyTouchCard files={weeklyFiles} totalSides={weekly.totalSides} doneSides={weekly.doneSides} />
        </div>
      )}
    </>
  );
}
