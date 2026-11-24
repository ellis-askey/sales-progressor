import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { listAllTasksForAgent, listProgressorInboxTasks, listInternalSelfAssignedTasks } from "@/lib/services/manual-tasks";
import { listReviews } from "@/lib/services/reviews";
import { getAccessScope } from "@/lib/security/access-scope";
import { agencyHasActiveOutsourcedFile } from "@/lib/agent/outsourcing";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { hasAdminPowers } from "@/lib/agent-session";
import { listAttachableFiles } from "@/lib/services/work-queue";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { isBusinessOwnerViewer, getProgressorCopy } from "@/lib/services/progression-clients";
import { toUKDateStr } from "@/lib/utils";
import { isFounder } from "./access";
import { TodoNext } from "./TodoNext";
import type { TodoNextData } from "./types";

// Isolated founder-only redesign of /agent/to-do. READ path mirrors the live page
// verbatim so the data is identical; nothing here mutates. All actions in the
// client are preview-only (no server actions are imported or called).
export default async function TodoNextPage() {
  const session = await requireSession();
  if (!isFounder(session)) notFound(); // defence-in-depth (also gated in layout)

  const role = session.user.role;
  const isProgressor = role === "sales_progressor";
  const isInternal = role === "sales_progressor" || role === "admin" || role === "superadmin";
  const isBusinessOwner = isProgressor ? await isBusinessOwnerViewer(session) : false;
  const scope = getAccessScope(session);

  const ownTasks = session.user.agencyId
    ? await listAllTasksForAgent(session.user.id, session.user.agencyId)
    : [];
  const inboxTasks = isProgressor ? await listProgressorInboxTasks(session.user.id) : [];
  const internalTasks = isInternal ? await listInternalSelfAssignedTasks(scope, session.user.id) : [];
  const tasks = [...ownTasks, ...inboxTasks, ...internalTasks];

  const reviews = await listReviews(scope);
  const reviewsDueCount = reviews.items.filter(
    (i) => i.reviewDate && toUKDateStr(i.reviewDate) <= toUKDateStr(new Date()),
  ).length;

  const taskPhotos = await getSignedUrlMap(
    tasks.map((t) => t.transaction?.photoStoragePath).filter((p): p is string => !!p),
  );
  const photoByTx: Record<string, string | null> = {};
  for (const t of tasks) {
    if (t.transactionId && t.transaction?.photoStoragePath) {
      photoByTx[t.transactionId] = taskPhotos.get(t.transaction.photoStoragePath) ?? null;
    }
  }

  const vis = isInternal
    ? resolveInternalVisibility(session.user.id, role, hasAdminPowers(session), session.user.progressionBusinessId, session.user.progressionBusinessRole, session.user.canViewAllFiles)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const attachableFiles = await listAttachableFiles(vis);

  const hasOutsourced = await agencyHasActiveOutsourcedFile(session.user.agencyId);
  const pc = !isProgressor && hasOutsourced ? await getProgressorCopy(session.user.agencyId) : { count: 0, name: null };
  const progressorName = pc.count >= 2 ? "your progressors" : pc.name;
  const canUseProgressor = !isProgressor && hasOutsourced;

  const subtitle = isProgressor
    ? "Your management notes, plus requests from agents."
    : hasOutsourced
      ? `Your notes, plus anything you've flagged to ${pc.count >= 2 ? "your progressors" : "your progressor"}.`
      : "Your notes and reminders.";

  const data: TodoNextData = {
    tasks, reviews: { items: reviews.items, done: reviews.done }, photoByTx, attachableFiles,
    role, isProgressor, isInternal, canUseProgressor, hasOutsourced, progressorName, reviewsDueCount,
    subtitle, viewerName: session.user.name, viewerEmail: session.user.email,
  };

  return <TodoNext data={data} />;
}
