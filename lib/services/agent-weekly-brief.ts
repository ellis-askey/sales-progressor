import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { getActiveFlags } from "@/lib/services/problem-detection";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { resolveDisplayStages, type ResolvedStage } from "@/lib/milestones/display-stages";
import { extractFirstName } from "@/lib/contacts/displayName";
import { getNotificationPrefsForUsers } from "@/lib/agent/notification-prefs";
import { buildWeeklyBrief } from "@/lib/emails/weekly-brief";

// One of four honest per-file states, in priority order. A self-managed file
// that the system has flagged (stalled / overdue / gone quiet) can never read
// "on track" — it lands in "slow". Outsourced files never carry a problem
// state (our internal team runs the chase; those signals are internal ops, not
// something the agency acts on) — they only ever show "exchange" or "ontrack".
type FileState = "attention" | "slow" | "exchange" | "ontrack";

type AgentFile = {
  id: string;
  address: string;
  serviceType: string;
  expectedExchangeDate: Date | null;
  state: FileState;
  stageLabel: string;
  completed: number;
  total: number;
  completedThisWeek: number;
  // Populated only on "slow" files — the plain-English reason the system
  // flagged it, so the row explains itself instead of just asserting.
  reason: string | null;
};

// Sort priority only (the new template owns labels/colours).
const STATE_ORDER: Record<FileState, number> = { attention: 0, slow: 1, exchange: 2, ontrack: 3 };

// The honest state decision, isolated so it can be tested directly. A self-managed
// file with an active problem flag can NEVER return "ontrack" — it returns "slow".
// Outsourced files are held to progress-only states ("exchange" / "ontrack")
// regardless of flags or escalations, because those signals describe our internal
// team's chase work, not the agency's — so an agency user is never chased about a
// TSP-managed file.
export function deriveFileState(input: {
  serviceType: string;
  escalatedTaskCount: number;
  exchangeSoon: boolean;
  activeFlagCount: number;
}): FileState {
  if (input.serviceType === "outsourced") {
    return input.exchangeSoon ? "exchange" : "ontrack";
  }
  if (input.escalatedTaskCount > 0) return "attention";
  if (input.exchangeSoon) return "exchange";
  if (input.activeFlagCount > 0) return "slow";
  return "ontrack";
}

function daysUntil(d: Date) {
  return Math.round((new Date(d).setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / 86400000);
}

// The stage the file is actually in right now, read the same way the file-page
// timeline strip reads it (resolveDisplayStages): the latest stage in progress,
// else the stage up next, else — everything done — "Completing".
function currentStageLabel(stages: ResolvedStage[]): string {
  const inProgress = stages.filter((s) => s.status === "in_progress");
  if (inProgress.length > 0) return inProgress[inProgress.length - 1].name;
  const upNext = stages.find((s) => s.status === "up_next");
  if (upNext) return upNext.name;
  if (stages.length > 0 && stages.every((s) => s.status === "complete")) return "Completing";
  const complete = stages.filter((s) => s.status === "complete");
  if (complete.length > 0) return complete[complete.length - 1].name;
  return "Getting started";
}

const FILE_CAP = 8; // rows shown; the rest roll into a "+N more" link

export async function sendAgentWeeklyBriefs(agencyId: string): Promise<number> {
  const { from: fromAddr, replyTo } = await resolveAgencySender(agencyId);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const agents = await prisma.user.findMany({
    where: { agencyId, role: { in: ["negotiator", "director"] } },
    select: { id: true, name: true, email: true, role: true },
  });

  // Per-user opt-out: skip anyone with notifications.weeklyBrief === false.
  const prefsByUser = await getNotificationPrefsForUsers(agents.map((a) => a.id));

  let sent = 0;
  const base = process.env.NEXTAUTH_URL ?? "";

  // Active problem flags for the agency, keyed by transactionId. These are the
  // system's own honest signals (milestone_stalled, overdue_milestone,
  // long_silence, gone-quiet, etc.) — the same rows that drive the hub alerts.
  const allFlags = await getActiveFlags(agencyId).catch(() => [] as Awaited<ReturnType<typeof getActiveFlags>>);
  const flagsByTx = new Map<string, typeof allFlags>();
  for (const flag of allFlags) {
    const arr = flagsByTx.get(flag.transaction.id) ?? [];
    arr.push(flag);
    flagsByTx.set(flag.transaction.id, arr);
  }

  for (const agent of agents) {
    if (!agent.email) continue;
    if (prefsByUser.get(agent.id)?.weeklyBrief === false) continue;

    // Directors see the whole branch; negotiators see only their own sales — the
    // same scope each role opens when they click through to the pipeline.
    const isDirector = agent.role === "director";
    const transactions = await prisma.propertyTransaction.findMany({
      where: isDirector
        ? { agencyId, status: "active" }
        : { agencyId, agentUserId: agent.id, status: "active" },
      select: {
        id: true,
        propertyAddress: true,
        expectedExchangeDate: true,
        overridePredictedDate: true,
        completionDate: true,
        serviceType: true,
        chaseTasks: {
          where: { status: "pending", priority: "escalated" },
          select: { id: true },
        },
      },
    });

    if (transactions.length === 0) continue;

    const files: AgentFile[] = await Promise.all(
      transactions.map(async (tx) => {
        // Real progress, read exactly as the file page reads it (round-scoped
        // milestone rows → display stages). Degrade gracefully if the milestone
        // load fails: the file still shows with its honest state, just no
        // stage/step detail.
        let stageLabel = "In progress";
        let completed = 0;
        let total = 0;
        let completedThisWeek = 0;
        try {
          const { vendor, purchaser } = await getMilestonesForTransaction(tx.id, agencyId);
          const rows = [...vendor, ...purchaser];
          total = rows.length;
          completed = rows.filter((r) => r.isComplete).length;
          completedThisWeek = rows.filter(
            (r) => r.isComplete && r.completion?.completedAt && new Date(r.completion.completedAt) >= sevenDaysAgo,
          ).length;
          stageLabel = currentStageLabel(
            resolveDisplayStages(rows, {
              expectedExchangeDate: tx.expectedExchangeDate ?? null,
              overridePredictedDate: tx.overridePredictedDate ?? null,
              targetCompletionDate: tx.completionDate ?? null,
            }),
          );
        } catch {
          // leave the safe defaults above
        }

        const exchangeSoon =
          tx.expectedExchangeDate != null &&
          daysUntil(tx.expectedExchangeDate) >= 0 &&
          daysUntil(tx.expectedExchangeDate) <= 14;
        const flags = flagsByTx.get(tx.id) ?? [];

        const state = deriveFileState({
          serviceType: tx.serviceType,
          escalatedTaskCount: tx.chaseTasks.length,
          exchangeSoon,
          activeFlagCount: flags.length,
        });

        return {
          id: tx.id,
          address: tx.propertyAddress,
          serviceType: tx.serviceType,
          expectedExchangeDate: tx.expectedExchangeDate ?? null,
          state,
          stageLabel,
          completed,
          total,
          completedThisWeek,
          reason: state === "slow" ? flags[0]?.reason ?? null : null,
        };
      }),
    );

    files.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);

    const attentionCount = files.filter((f) => f.state === "attention").length;
    const movedThisWeek = files.reduce((sum, f) => sum + f.completedThisWeek, 0);

    const shown = files.slice(0, FILE_CAP);
    const moreCount = Math.max(0, files.length - FILE_CAP);

    const built = buildWeeklyBrief({
      firstName: extractFirstName(agent.name),
      weekOf: new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
      activeSales: transactions.length,
      milestonesThisWeek: movedThisWeek,
      needsAttention: attentionCount,
      files: shown.map((f) => ({
        address: f.address,
        url: `${base}/agent/transactions/${f.id}`,
        state: f.state,
        stageLabel: f.stageLabel,
        completed: f.completed,
        total: f.total,
        reason: f.reason ?? undefined,
      })),
      moreCount,
      pipelineUrl: `${base}/agent/transactions`,
      unsubscribeUrl: `${base}/agent/account/notifications`,
    });

    await sendAgentEmail({
      to: agent.email,
      subject: built.subject,
      text: built.text,
      html: built.html,
      from: fromAddr,
      replyTo,
      kind: "weekly_brief",
      userId: agent.id,
      agencyId,
    }).catch(() => {});
    sent++;
  }

  return sent;
}
