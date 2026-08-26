import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { getActiveFlags } from "@/lib/services/problem-detection";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { resolveDisplayStages, type ResolvedStage } from "@/lib/milestones/display-stages";
import { extractFirstName } from "@/lib/contacts/displayName";
import { getNotificationPrefsForUsers } from "@/lib/agent/notification-prefs";

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

const STATE_META: Record<FileState, { label: string; colour: string; order: number }> = {
  attention: { label: "Needs a nudge",        colour: "#b91c1c", order: 0 },
  slow:      { label: "Moving slowly",       colour: "#b45309", order: 1 },
  exchange:  { label: "Exchange approaching", colour: "#166534", order: 2 },
  ontrack:   { label: "On track",            colour: "#166534", order: 3 },
};

// The honest state decision, isolated so it can be tested directly. This is the
// fix: a self-managed file with an active problem flag can NEVER return
// "ontrack" — it returns "slow". Outsourced files are held to progress-only
// states ("exchange" / "ontrack") regardless of flags or escalations, because
// those signals describe our internal team's chase work, not the agency's.
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

export async function sendAgentWeeklyBriefs(agencyId: string): Promise<number> {
  const { from: fromAddr, replyTo } = await resolveAgencySender(agencyId);

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const agents = await prisma.user.findMany({
    where: { agencyId, role: { in: ["negotiator", "director"] } },
    select: { id: true, name: true, email: true },
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

    const transactions = await prisma.propertyTransaction.findMany({
      where: { agencyId, agentUserId: agent.id, status: "active" },
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

    files.sort((a, b) => STATE_META[a.state].order - STATE_META[b.state].order);

    const attentionCount = files.filter((f) => f.state === "attention").length;
    const slowCount = files.filter((f) => f.state === "slow").length;
    const exchangeCount = files.filter((f) => f.state === "exchange").length;
    const movedThisWeek = files.reduce((sum, f) => sum + f.completedThisWeek, 0);

    const subject =
      attentionCount > 0
        ? `${attentionCount} file${attentionCount !== 1 ? "s" : ""} ${attentionCount === 1 ? "needs" : "need"} a nudge this week`
        : slowCount > 0
          ? `${slowCount} file${slowCount !== 1 ? "s" : ""} to keep moving this week`
          : `All your files are on track this week`;

    // Honest header qualifier — "all progressing normally" only when it is true.
    const qualifier =
      attentionCount > 0
        ? ` · ${attentionCount} need${attentionCount === 1 ? "s" : ""} a nudge`
        : slowCount > 0
          ? ` · ${slowCount} moving slowly`
          : ` · all progressing normally`;

    // ── Plain-text body ──────────────────────────────────────────────────────
    const lines: string[] = [
      `Good morning, ${extractFirstName(agent.name)}.`,
      ``,
      `Here is your weekly summary for the week starting ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
      ``,
      `You have ${transactions.length} active file${transactions.length !== 1 ? "s" : ""}.`,
    ];
    if (movedThisWeek > 0) {
      lines.push(`${movedThisWeek} milestone${movedThisWeek !== 1 ? "s" : ""} completed across your files this week.`);
    }
    lines.push(``, `Your files:`);
    for (const f of files) {
      const meta = STATE_META[f.state];
      const steps = f.total > 0 ? `${f.stageLabel}, ${f.completed} of ${f.total} steps` : f.stageLabel;
      lines.push(`  · ${f.address}: ${steps} · ${meta.label}`);
      if (f.reason) lines.push(`      ${f.reason}`);
    }
    lines.push(``, `Have a productive week.`);

    // ── HTML body ────────────────────────────────────────────────────────────
    const rowsHtml = files
      .map((f) => {
        const meta = STATE_META[f.state];
        const steps = f.total > 0 ? `${f.stageLabel} · ${f.completed} of ${f.total} steps` : f.stageLabel;
        const reasonHtml = f.reason
          ? `<div style="color:#9ca3af;font-size:11px;margin-top:2px">${f.reason}</div>`
          : "";
        return `<tr>
  <td style="padding:12px 0;border-top:1px solid #f0f0f2;vertical-align:top">
    <a href="${base}/agent/transactions/${f.id}" style="color:#1a1d29;text-decoration:none;font-weight:600;font-size:14px">${f.address}</a>
    <div style="color:#6b7280;font-size:12px;margin-top:2px">${steps}</div>
  </td>
  <td style="padding:12px 0;border-top:1px solid #f0f0f2;text-align:right;white-space:nowrap;vertical-align:top">
    <span style="color:${meta.colour};font-size:13px;font-weight:600">${meta.label}</span>
    ${reasonHtml}
  </td>
</tr>`;
      })
      .join("\n");

    const momentumHtml =
      movedThisWeek > 0
        ? `<p style="margin:0 0 20px;color:#166534;font-size:13px;font-weight:600">${movedThisWeek} milestone${movedThisWeek !== 1 ? "s" : ""} completed across your files this week.</p>`
        : "";

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">Week of ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">Good morning, ${extractFirstName(agent.name)}.</h1>
<p style="margin:0 0 8px;color:#4a5162;font-size:14px">You have <strong>${transactions.length}</strong> active file${transactions.length !== 1 ? "s" : ""}${qualifier}.${exchangeCount > 0 ? ` ${exchangeCount} approaching exchange.` : ""}</p>
${momentumHtml}
<table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tbody>${rowsHtml}</tbody></table>
<p style="margin:0 0 24px"><a href="${base}/agent/transactions" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View your files →</a></p>
<p style="margin:24px 0 0;font-size:11px;color:#c0c4d0;text-align:center">Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a></p>
</body></html>`;

    await sendAgentEmail({ to: agent.email, subject, text: lines.join("\n"), html, from: fromAddr, replyTo, kind: "weekly_brief", userId: agent.id, agencyId }).catch(() => {});
    sent++;
  }

  return sent;
}
