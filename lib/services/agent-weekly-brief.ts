import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getActiveFlags, FLAG_LABELS } from "@/lib/services/problem-detection";
import { extractFirstName } from "@/lib/contacts/displayName";

type AgentFile = {
  id: string;
  address: string;
  expectedExchangeDate: Date | null;
  escalatedTasks: number;
  lastActivityDaysAgo: number | null;
};

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysUntil(d: Date) {
  return Math.round((new Date(d).setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / 86400000);
}

export async function sendAgentWeeklyBriefs(agencyId: string): Promise<number> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

  const agents = await prisma.user.findMany({
    where: { agencyId, role: { in: ["negotiator", "director"] } },
    select: { id: true, name: true, email: true },
  });

  let sent = 0;
  const base = process.env.NEXTAUTH_URL ?? "";

  // Get all active flags for the agency, keyed by transactionId
  const allFlags = await getActiveFlags(agencyId).catch(() => [] as Awaited<ReturnType<typeof getActiveFlags>>);
  const flagsByTx = new Map<string, typeof allFlags>();
  for (const flag of allFlags) {
    const arr = flagsByTx.get(flag.transaction.id) ?? [];
    arr.push(flag);
    flagsByTx.set(flag.transaction.id, arr);
  }

  for (const agent of agents) {
    if (!agent.email) continue;

    const transactions = await prisma.propertyTransaction.findMany({
      where: { agencyId, agentUserId: agent.id, status: "active" },
      select: {
        id: true,
        propertyAddress: true,
        expectedExchangeDate: true,
        chaseTasks: {
          where: { status: "pending", priority: "escalated" },
          select: { id: true },
        },
        communications: {
          where: { createdAt: { gte: fourteenDaysAgo } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    if (transactions.length === 0) continue;

    const files: AgentFile[] = transactions.map((tx) => ({
      id: tx.id,
      address: tx.propertyAddress,
      expectedExchangeDate: tx.expectedExchangeDate ?? null,
      escalatedTasks: tx.chaseTasks.length,
      lastActivityDaysAgo: tx.communications[0]?.createdAt
        ? Math.floor((Date.now() - new Date(tx.communications[0].createdAt).getTime()) / 86400000)
        : null,
    }));

    const needsAttention = files.filter((f) => f.escalatedTasks > 0 || (f.lastActivityDaysAgo !== null && f.lastActivityDaysAgo > 14));
    const exchangeSoon = files.filter((f) => f.expectedExchangeDate && daysUntil(f.expectedExchangeDate) >= 0 && daysUntil(f.expectedExchangeDate) <= 14);
    const allGood = files.filter((f) => !needsAttention.includes(f) && !exchangeSoon.includes(f));

    const subject = needsAttention.length > 0
      ? `Weekly briefing — ${needsAttention.length} file${needsAttention.length !== 1 ? "s" : ""} need attention`
      : `Weekly briefing — ${transactions.length} active file${transactions.length !== 1 ? "s" : ""}`;

    const lines: string[] = [
      `Good morning, ${extractFirstName(agent.name)}.`,
      ``,
      `Here is your weekly summary for the week starting ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
      ``,
      `You have ${transactions.length} active file${transactions.length !== 1 ? "s" : ""}.`,
    ];

    if (exchangeSoon.length > 0) {
      lines.push(``, `Approaching exchange (next 14 days):`);
      for (const f of exchangeSoon) {
        const days = daysUntil(f.expectedExchangeDate!);
        lines.push(`  · ${f.address} — target ${fmtDate(f.expectedExchangeDate!)} (${days === 0 ? "today" : `${days}d`})`);
      }
    }

    if (needsAttention.length > 0) {
      lines.push(``, `Files needing attention:`);
      for (const f of needsAttention) {
        const reasons: string[] = [];
        if (f.escalatedTasks > 0) reasons.push(`${f.escalatedTasks} escalated chase${f.escalatedTasks > 1 ? "s" : ""}`);
        if (f.lastActivityDaysAgo !== null && f.lastActivityDaysAgo > 14) reasons.push(`no activity in ${f.lastActivityDaysAgo} days`);
        lines.push(`  · ${f.address} — ${reasons.join(", ")}`);
      }
    }

    if (allGood.length > 0 && needsAttention.length === 0) {
      lines.push(``, `All files are progressing normally. No issues to flag.`);
    }

    // AI-detected flags for this agent's files
    const agentFlaggedFiles = files
      .map((f) => ({ file: f, flags: flagsByTx.get(f.id) ?? [] }))
      .filter(({ flags }) => flags.length > 0);

    if (agentFlaggedFiles.length > 0) {
      lines.push(``, `Proactive alerts (AI-detected):`);
      for (const { file, flags } of agentFlaggedFiles) {
        const kinds = flags.map((f) => FLAG_LABELS[f.kind as keyof typeof FLAG_LABELS] ?? f.kind).join(", ");
        lines.push(`  · ${file.address} — ${kinds}: ${flags[0].reason}`);
      }
    }

    lines.push(``, `Have a productive week.`);

    const buildRows = (label: string, colour: string, items: AgentFile[], badge: (f: AgentFile) => string) =>
      items.length === 0 ? "" : [
        `<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:13px;color:${colour}">${label}</td></tr>`,
        ...items.map((f) =>
          `<tr><td style="padding:3px 0"><a href="${base}/agent/transactions/${f.id}" style="color:#3b82f6;text-decoration:none;font-size:13px">${f.address}</a></td><td style="padding:3px 0 3px 12px;white-space:nowrap;font-size:13px;color:${colour}">${badge(f)}</td></tr>`
        ),
      ].join("\n");

    const flagsRows = agentFlaggedFiles.length > 0
      ? [
          `<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:13px;color:#7c3aed">🤖 Proactive alerts</td></tr>`,
          ...agentFlaggedFiles.map(({ file, flags }) => {
            const label = flags.map((f) => FLAG_LABELS[f.kind as keyof typeof FLAG_LABELS] ?? f.kind).join(", ");
            return `<tr><td style="padding:3px 0"><a href="${base}/transactions/${file.id}" style="color:#3b82f6;text-decoration:none;font-size:13px">${file.address}</a></td><td style="padding:3px 0 3px 12px;font-size:13px;color:#7c3aed">${label}</td></tr>`;
          }),
        ].join("\n")
      : "";

    const tableRows = [
      buildRows("📅 Approaching exchange", "#166534", exchangeSoon, (f) => `${fmtDate(f.expectedExchangeDate!)} (${daysUntil(f.expectedExchangeDate!)}d)`),
      buildRows("⚠ Needs attention", "#b91c1c", needsAttention, (f) => {
        if (f.escalatedTasks > 0) return `${f.escalatedTasks} escalated`;
        return `No activity ${f.lastActivityDaysAgo}d`;
      }),
      buildRows("✓ On track", "#166534", allGood, () => "progressing"),
      flagsRows,
    ].filter(Boolean).join("\n");

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">Week of ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">Good morning, ${extractFirstName(agent.name)}.</h1>
<p style="margin:0 0 20px;color:#4a5162;font-size:14px">You have <strong>${transactions.length}</strong> active file${transactions.length !== 1 ? "s" : ""}${needsAttention.length > 0 ? ` · <strong style="color:#ef4444">${needsAttention.length} need${needsAttention.length === 1 ? "s" : ""} attention</strong>` : " · all progressing normally"}.${exchangeSoon.length > 0 ? ` ${exchangeSoon.length} approaching exchange.` : ""}</p>
${tableRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tbody>${tableRows}</tbody></table>` : ""}
<p style="margin:0 0 24px"><a href="${base}/agent/dashboard" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View your files →</a></p>
<p style="margin:0;font-size:12px;color:#8b91a3">Weekly summary from Sales Progressor. Sent every Monday morning.</p>
</body></html>`;

    await sendEmail({ to: agent.email, subject, text: lines.join("\n"), html }).catch(() => {});
    sent++;
  }

  return sent;
}
