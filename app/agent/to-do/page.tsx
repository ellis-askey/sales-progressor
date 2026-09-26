import { requireSession } from "@/lib/session";
import { listAllTasksForAgent, listProgressorInboxTasks, listInternalSelfAssignedTasks } from "@/lib/services/manual-tasks";
import { listReviews } from "@/lib/services/reviews";
import { getAccessScope } from "@/lib/security/access-scope";
import { agencyHasActiveOutsourcedFile } from "@/lib/agent/outsourcing";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { hasAdminPowers } from "@/lib/agent-session";
import { getNoCommsFiles } from "@/lib/services/hub";
import { listAttachableFiles } from "@/lib/services/work-queue";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { AgentTodoList } from "@/components/agent/AgentTodoList";
import { ReviewsSection } from "@/components/agent/ReviewsSection";
import { NoCommsCard } from "@/components/todos/NoCommsCard";
import { TodoEmptyState } from "@/components/agent/TodoEmptyState";
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

  // Agent-side tasks are agency-scoped; internal staff have agencyId=null
  // so listAllTasksForAgent returns empty for them. Internal tasks come
  // from listInternalSelfAssignedTasks (no agency filter).
  const ownTasks = session.user.agencyId
    ? await listAllTasksForAgent(session.user.id, session.user.agencyId)
    : [];
  const inboxTasks = isProgressor ? await listProgressorInboxTasks(session.user.id) : [];
  const internalTasks = isInternal ? await listInternalSelfAssignedTasks() : [];
  const tasks = [...ownTasks, ...inboxTasks, ...internalTasks];

  // "Reviews due" — files on hold with a return date (incl. chain-collapse
  // waits + remarketing) plus hand-typed reviews, scoped to what this user can
  // see. Read straight from the hold periods, so no duplicate rows to sync.
  const reviews = await listReviews(getAccessScope(session));
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
    ? resolveInternalVisibility(session.user.id, role, hasAdminPowers(session))
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const noCommsRaw = await getNoCommsFiles(vis);
  const noCommsPhotos = await getSignedUrlMap(
    noCommsRaw.map((i) => i.photoStoragePath).filter((p): p is string => !!p),
  );
  const noCommsItems = noCommsRaw.map((i) => ({
    ...i,
    photoUrl: i.photoStoragePath ? noCommsPhotos.get(i.photoStoragePath) ?? null : null,
  }));

  // Files this user can attach a new to-do to (id + address) — for the picker.
  const attachableFiles = await listAttachableFiles(vis);

  // "Your progressor" wording + controls only make sense once the agency has a
  // file being progressed by our team. Self-managed-only agencies never see it.
  const hasOutsourced = await agencyHasActiveOutsourcedFile(session.user.agencyId);

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
      {tasks.length === 0 && !hasReviews && !isInternal && noCommsItems.length === 0 ? (
        // Brand-new agency user: the onboarding empty state (full width, mock).
        <div className="px-4 md:px-8 py-2 md:py-4">
          <TodoEmptyState canUseProgressor={hasOutsourced} />
        </div>
      ) : (
        <div className="px-4 md:px-8 py-2 md:py-4 todo-cols">
          <div className="todo-col-main space-y-8">
            {hasReviews && (
              <ReviewsSection initialItems={reviews.items} initialDone={reviews.done} />
            )}
            <AgentTodoList initialTasks={tasks} role={role} hasOutsourced={hasOutsourced} photoByTx={taskPhotoByTx} attachableFiles={attachableFiles} />
          </div>
          {noCommsItems.length > 0 && (
            <div className="todo-col-side">
              <NoCommsCard items={noCommsItems} />
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
