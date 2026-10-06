import { requireSession } from "@/lib/session";
import { listAllTasksForAgent, listProgressorInboxTasks, listInternalSelfAssignedTasks } from "@/lib/services/manual-tasks";
import { listReviews } from "@/lib/services/reviews";
import { getAccessScope } from "@/lib/security/access-scope";
import { agencyHasActiveOutsourcedFile } from "@/lib/agent/outsourcing";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { hasAdminPowers } from "@/lib/agent-session";
import { getWeeklyTouch } from "@/lib/services/hub";
import { listAttachableFiles } from "@/lib/services/work-queue";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { AgentTodoList } from "@/components/agent/AgentTodoList";
import { ReviewsSection } from "@/components/agent/ReviewsSection";
import { WeeklyTouchCard, type WeeklyTouchFileView } from "@/components/todos/WeeklyTouchCard";
import { TodoEmptyState } from "@/components/agent/TodoEmptyState";
import { isBusinessOwnerViewer, getInvitingProgressorName } from "@/lib/services/progression-clients";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatPill } from "@/components/layout/StatPill";
import type { PillColor } from "@/components/layout/StatPill";
import { toUKDateStr } from "@/lib/utils";
import { PageReveal } from "@/components/agent/PageReveal";

export default async function AgentTodoPage() {
  const session = await requireSession();
  const role = session.user.role;
  const isProgressor = role === "sales_progressor";
  const isInternal = role === "sales_progressor" || role === "admin" || role === "superadmin";
  const isBusinessOwner = isProgressor ? await isBusinessOwnerViewer(session) : false;
  // The viewer's access scope — bounds the internal-task bucket to their OWN book
  // (TSP's own files for admins, this business's files for a progressor), so no
  // internal task ever leaks across businesses or between TSP and a business.
  const scope = getAccessScope(session);

  // Agent-side tasks are agency-scoped; internal staff have agencyId=null
  // so listAllTasksForAgent returns empty for them. Internal self-assigned tasks
  // come from listInternalSelfAssignedTasks, scoped to the viewer's book.
  const ownTasks = session.user.agencyId
    ? await listAllTasksForAgent(session.user.id, session.user.agencyId)
    : [];
  const inboxTasks = isProgressor ? await listProgressorInboxTasks(session.user.id) : [];
  const internalTasks = isInternal ? await listInternalSelfAssignedTasks(scope) : [];
  const tasks = [...ownTasks, ...inboxTasks, ...internalTasks];

  // "Reviews due" — files on hold with a return date (incl. chain-collapse
  // waits + remarketing) plus hand-typed reviews, scoped to what this user can
  // see. Read straight from the hold periods, so no duplicate rows to sync.
  const reviews = await listReviews(scope);
  const reviewsDueCount = reviews.items.filter(
    (i) => i.reviewDate && toUKDateStr(i.reviewDate) <= toUKDateStr(new Date()),
  ).length;
  const hasReviews = reviews.items.length > 0 || reviews.done.length > 0;

  // Sign the property photos for the task groups (keyed by transaction), so each
  // to-do file group shows its property photo like every other list.
  const taskPhotos = await getSignedUrlMap(
    tasks.map((t) => t.transaction?.photoStoragePath).filter((p): p is string => !!p),
  );
  const taskPhotoByTx = new Map<string, string | null>();
  for (const t of tasks) {
    if (t.transactionId && t.transaction?.photoStoragePath) {
      taskPhotoByTx.set(t.transactionId, taskPhotos.get(t.transaction.photoStoragePath) ?? null);
    }
  }

  // "No comms" (right column) — files we've gone quiet on, split per side.
  // Needs AgentVisibility (buildTxWhere), resolved the same way the hub and
  // work queue do. Photos signed once, keyed by transaction.
  const vis = isInternal
    ? resolveInternalVisibility(session.user.id, role, hasAdminPowers(session), session.user.progressionBusinessId, session.user.progressionBusinessRole, session.user.canViewAllFiles)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);
  // Weekly "touch every file" (right column) — both sides of every active file,
  // quiet ones first. The old No-comms behaviour lives on inside it (quiet sides
  // are flagged + sorted up). Photos signed once, keyed by transaction.
  const weekly = await getWeeklyTouch(vis);
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

  // Files this user can attach a new to-do to (id + address) — for the picker.
  const attachableFiles = await listAttachableFiles(vis);

  // "Your progressor" wording + controls only make sense once the agency has a
  // file being progressed by our team. Self-managed-only agencies never see it.
  const hasOutsourced = await agencyHasActiveOutsourcedFile(session.user.agencyId);
  // The business progressing this agency's files (null = TSP-outsourced /
  // self-signup → keeps "our team"/"TSP" framing). Only an invited agency needs it.
  const progressorName = !isProgressor && hasOutsourced
    ? await getInvitingProgressorName(session.user.agencyId)
    : null;

  const todayStr = toUKDateStr(new Date());

  const ownOpen      = tasks.filter((t) => !t.isAgentRequest && t.status === "open");
  const progOpen     = tasks.filter((t) =>  t.isAgentRequest && t.status === "open");
  const overdueOpen  = tasks.filter((t) => t.status === "open" && t.dueDate && toUKDateStr(t.dueDate) < todayStr);
  const overdueCount = overdueOpen.length;
  const hasRedOverdue = overdueOpen.some((t) => {
    const dueStr = toUKDateStr(t.dueDate!);
    return Math.round((new Date(todayStr).getTime() - new Date(dueStr).getTime()) / 86400000) >= 4;
  });

  const subtitle = isProgressor
    ? "Your management notes, plus requests from agents."
    : hasOutsourced
      ? "Your notes, plus anything you've flagged to your progressor."
      : "Your notes and reminders.";

  const progLabel = isProgressor ? "from agents" : "with progressor";

  const statSegs = [
    reviewsDueCount > 0 && { key: "reviews", label: `${reviewsDueCount} to review`,                                href: "#section-reviews",    pillColor: "warning" as PillColor },
    ownOpen.length > 0  && { key: "mine",    label: `${ownOpen.length} to-do${ownOpen.length === 1 ? "" : "s"}`, href: "#section-mine",       pillColor: "muted"   as PillColor },
    progOpen.length > 0 && { key: "prog",    label: `${progOpen.length} ${progLabel}`,                            href: "#section-progressor", pillColor: "warning" as PillColor },
    overdueCount > 0    && { key: "overdue", label: `${overdueCount} overdue`,                                     href: "#section-mine",       pillColor: "danger"  as PillColor },
  ].filter(Boolean) as { key: string; label: string; href: string; pillColor: PillColor }[];

  // hasRedOverdue is unused in the stat pill render but kept for future colour-coding parity
  void hasRedOverdue;

  return (
    <>
      <PageHeader title="To-Do" subtitle={subtitle}>
        {statSegs.map(seg => (
          <StatPill key={seg.key} href={seg.href} label={seg.label} color={seg.pillColor} />
        ))}
      </PageHeader>

      <PageReveal>
      {tasks.length === 0 && !hasReviews && (!isInternal || isBusinessOwner) && weekly.totalSides === 0 ? (
        // Brand-new agency user OR progression-business owner: the onboarding
        // empty state. An owner has no TSP progressor to send to, so the
        // "send to your progressor" card is off for them.
        <div className="px-4 md:px-8 py-2 md:py-4">
          <TodoEmptyState canUseProgressor={isBusinessOwner ? false : hasOutsourced} progressorName={progressorName} />
        </div>
      ) : (
        <div className="px-4 md:px-8 py-2 md:py-4 todo-cols">
          <div className="todo-col-main space-y-8">
            {hasReviews && (
              <ReviewsSection initialItems={reviews.items} initialDone={reviews.done} />
            )}
            <AgentTodoList initialTasks={tasks} role={role} hasOutsourced={hasOutsourced} photoByTx={taskPhotoByTx} attachableFiles={attachableFiles} progressorName={progressorName} />
          </div>
          {weekly.totalSides > 0 && (
            <div className="todo-col-side">
              <WeeklyTouchCard files={weeklyFiles} totalSides={weekly.totalSides} doneSides={weekly.doneSides} />
            </div>
          )}
        </div>
      )}
      </PageReveal>
    </>
  );
}

// Perceived-performance (2026-09-18): let the client router reuse this
// page for 5 minutes after a visit — moving around a working burst never
// re-renders a page you just saw. Per-page opt-in rather than a global
// staleTimes so buyer/seller portal navigation keeps its default
// always-fresh behaviour. Every mutation still purges this via its
// revalidatePath calls, and the "As of" button force-refreshes.
export const unstable_dynamicStaleTime = 300;
