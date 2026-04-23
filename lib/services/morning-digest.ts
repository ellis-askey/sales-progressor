import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

type DigestFile = {
  id: string;
  address: string;
  overdueChases: number;
  dueToday: number;
  exchangeTarget: Date | null;
};

type ProgressorDigest = {
  userId: string;
  name: string;
  email: string;
  activeCount: number;
  files: DigestFile[];
};

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysUntil(d: Date) {
  const ms = new Date(d).setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export async function buildMorningDigest(agencyId: string): Promise<ProgressorDigest[]> {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const progressors = await prisma.user.findMany({
    where: { agencyId, role: { in: ["admin", "sales_progressor", "director"] } },
    select: { id: true, name: true, email: true },
  });

  const results: ProgressorDigest[] = [];

  for (const user of progressors) {
    if (!user.email) continue;

    const transactions = await prisma.propertyTransaction.findMany({
      where: { agencyId, assignedUserId: user.id, status: "active" },
      select: {
        id: true,
        propertyAddress: true,
        expectedExchangeDate: true,
      },
    });

    if (transactions.length === 0) continue;

    const txIds = transactions.map((t) => t.id);

    const reminderLogs = await prisma.reminderLog.findMany({
      where: { transactionId: { in: txIds }, status: "active" },
      select: { transactionId: true, nextDueDate: true },
    });

    const files: DigestFile[] = [];

    for (const tx of transactions) {
      const logs = reminderLogs.filter((l) => l.transactionId === tx.id);
      let overdueChases = 0;
      let dueToday = 0;

      for (const log of logs) {
        const due = new Date(log.nextDueDate); due.setHours(12, 0, 0, 0);
        if (due < todayStart) overdueChases++;
        else if (due <= todayEnd) dueToday++;
      }

      const exchangeTarget = tx.expectedExchangeDate ?? null;
      const daysToExchange = exchangeTarget ? daysUntil(exchangeTarget) : null;
      const exchangeSoon   = daysToExchange !== null && daysToExchange >= 0 && daysToExchange <= 14;

      if (overdueChases > 0 || dueToday > 0 || exchangeSoon) {
        files.push({ id: tx.id, address: tx.propertyAddress, overdueChases, dueToday, exchangeTarget });
      }
    }

    files.sort((a, b) => (b.overdueChases + b.dueToday) - (a.overdueChases + a.dueToday));

    results.push({
      userId: user.id,
      name: user.name,
      email: user.email,
      activeCount: transactions.length,
      files,
    });
  }

  return results;
}

export async function sendMorningDigests(agencyId: string): Promise<number> {
  const digests = await buildMorningDigest(agencyId);
  let sent = 0;

  for (const d of digests) {
    const overdueTx    = d.files.filter((f) => f.overdueChases > 0);
    const dueTodayTx   = d.files.filter((f) => f.dueToday > 0 && f.overdueChases === 0);
    const exchangeSoon = d.files.filter(
      (f) => f.exchangeTarget && daysUntil(f.exchangeTarget) >= 0 && daysUntil(f.exchangeTarget) <= 14
    );
    const totalActions = d.files.reduce((s, f) => s + f.overdueChases + f.dueToday, 0);

    const greeting = new Date().getHours() < 12 ? "Good morning" : "Good afternoon";

    const subject = totalActions > 0
      ? `Morning briefing — ${totalActions} action${totalActions !== 1 ? "s" : ""} due`
      : `Morning briefing — ${d.activeCount} active file${d.activeCount !== 1 ? "s" : ""}`;

    const lines: string[] = [
      `${greeting}, ${d.name}.`,
      ``,
      `You have ${d.activeCount} active file${d.activeCount !== 1 ? "s" : ""} today.`,
    ];

    if (overdueTx.length > 0) {
      lines.push(``, `Overdue chases (${overdueTx.length} file${overdueTx.length !== 1 ? "s" : ""}):`);
      for (const f of overdueTx.slice(0, 8)) {
        lines.push(`  · ${f.address} — ${f.overdueChases} overdue`);
      }
    }
    if (dueTodayTx.length > 0) {
      lines.push(``, `Due today (${dueTodayTx.length} file${dueTodayTx.length !== 1 ? "s" : ""}):`);
      for (const f of dueTodayTx.slice(0, 8)) {
        lines.push(`  · ${f.address}`);
      }
    }
    if (exchangeSoon.length > 0) {
      lines.push(``, `Approaching exchange target:`);
      for (const f of exchangeSoon.slice(0, 8)) {
        const days = daysUntil(f.exchangeTarget!);
        lines.push(`  · ${f.address} — target ${fmtDate(f.exchangeTarget!)} (${days === 0 ? "today" : `${days}d away`})`);
      }
    }
    if (totalActions === 0 && exchangeSoon.length === 0) {
      lines.push(``, `No chases are due today.`);
    }
    lines.push(``, `Have a productive day.`);

    const base = process.env.NEXTAUTH_URL ?? "";

    const buildRows = (label: string, colour: string, items: DigestFile[], badge: (f: DigestFile) => string) =>
      items.length === 0 ? "" : [
        `<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:13px;color:${colour}">${label}</td></tr>`,
        ...items.slice(0, 8).map(
          (f) => `<tr><td style="padding:3px 0"><a href="${base}/transactions/${f.id}" style="color:#3b82f6;text-decoration:none;font-size:13px">${f.address}</a></td><td style="padding:3px 0 3px 12px;white-space:nowrap;font-size:13px;color:${colour}">${badge(f)}</td></tr>`
        ),
      ].join("\n");

    const tableRows = [
      buildRows("⚠ Overdue chases",        "#b91c1c", overdueTx,    (f) => `${f.overdueChases} overdue`),
      buildRows("📋 Due today",             "#92400e", dueTodayTx,   ()  => "1 due today"),
      buildRows("📅 Exchange approaching",  "#166534", exchangeSoon, (f) => fmtDate(f.exchangeTarget!)),
    ].filter(Boolean).join("\n");

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${greeting}, ${d.name}.</h1>
<p style="margin:0 0 20px;color:#4a5162;font-size:14px"><strong>${d.activeCount}</strong> active file${d.activeCount !== 1 ? "s" : ""}${totalActions > 0 ? ` · <strong style="color:#ef4444">${totalActions} action${totalActions !== 1 ? "s" : ""} due</strong>` : " · no actions due today"}.</p>
${tableRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tbody>${tableRows}</tbody></table>` : ""}
<p style="margin:0 0 24px"><a href="${base}/dashboard" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open dashboard</a></p>
<p style="margin:0;font-size:12px;color:#8b91a3">You're receiving this because you have active files assigned to you in Sales Progressor.</p>
</body></html>`;

    await sendEmail({ to: d.email, subject, text: lines.join("\n"), html }).catch(() => {});
    sent++;
  }

  return sent;
}
