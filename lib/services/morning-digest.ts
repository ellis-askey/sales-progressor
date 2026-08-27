import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { toUKDateStr } from "@/lib/utils";
import { getNotificationPrefsForUsers } from "@/lib/agent/notification-prefs";
import { pushExchangeApproaching, pushMortgageOfferExpiring } from "@/lib/agent/push-events";

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
  const todayStr = toUKDateStr(new Date());
  const dStr = toUKDateStr(d);
  return Math.round((new Date(dStr).getTime() - new Date(todayStr).getTime()) / 86400000);
}

export async function buildMorningDigest(agencyId: string): Promise<ProgressorDigest[]> {
  const todayStr = toUKDateStr(new Date());

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
        const dueStr = toUKDateStr(log.nextDueDate);
        if (dueStr < todayStr) overdueChases++;
        else if (dueStr === todayStr) dueToday++;
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
  const { from: fromAddr, replyTo } = await resolveAgencySender(agencyId);

  const digests = await buildMorningDigest(agencyId);

  // Per-user opt-out: skip anyone with notifications.morningDigest === false.
  // Defaults are ON, so users who haven't touched the toggle still receive.
  const prefsByUser = await getNotificationPrefsForUsers(digests.map((d) => d.userId));

  let sent = 0;

  for (const d of digests) {
    if (prefsByUser.get(d.userId)?.morningDigest === false) continue;

    const overdueTx    = d.files.filter((f) => f.overdueChases > 0);
    const dueTodayTx   = d.files.filter((f) => f.dueToday > 0 && f.overdueChases === 0);
    const exchangeSoon = d.files.filter(
      (f) => f.exchangeTarget && daysUntil(f.exchangeTarget) >= 0 && daysUntil(f.exchangeTarget) <= 14
    );
    const totalActions = d.files.reduce((s, f) => s + f.overdueChases + f.dueToday, 0);

    const greeting = new Date().getHours() < 12 ? "Good morning" : "Good afternoon";

    const subject = totalActions > 0
      ? `${totalActions} action${totalActions !== 1 ? "s" : ""} to clear today`
      : `Nothing urgent today. Quick check-in`;

    const lines: string[] = [
      `${greeting}, ${d.name}.`,
      ``,
      `You have ${d.activeCount} active file${d.activeCount !== 1 ? "s" : ""} today.`,
    ];

    if (overdueTx.length > 0) {
      lines.push(``, `Overdue chases (${overdueTx.length} file${overdueTx.length !== 1 ? "s" : ""}):`);
      for (const f of overdueTx.slice(0, 8)) {
        lines.push(`  · ${f.address}: ${f.overdueChases} overdue`);
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
        lines.push(`  · ${f.address}: target ${fmtDate(f.exchangeTarget!)} (${days === 0 ? "today" : `${days}d away`})`);
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
<p style="margin:24px 0 0;font-size:11px;color:#c0c4d0;text-align:center">Powered by <a href="https://www.thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none">Sales Progressor</a></p>
</body></html>`;

    await sendAgentEmail({ to: d.email, subject, text: lines.join("\n"), html, from: fromAddr, replyTo, kind: "morning_digest", userId: d.userId, agencyId }).catch(() => {});
    sent++;
  }

  return sent;
}

// Daily exchange-approaching sweep. Runs after the morning digest so it shares
// the cron pass. For every active file with expectedExchangeDate within 7 days,
// fires a push to the file owner ONCE per warning (dedup via a Notification
// row of type=exchange_approaching keyed on the date). The push helper itself
// checks each user's per-event toggle before firing.
export async function fireExchangeApproachingPushes(agencyId: string): Promise<number> {
  const todayMs = new Date().setUTCHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(todayMs + 7 * 86400000);

  const candidates = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      status: "active",
      expectedExchangeDate: { gte: new Date(todayMs), lte: sevenDaysFromNow },
    },
    select: {
      id: true,
      propertyAddress: true,
      expectedExchangeDate: true,
      assignedUserId: true,
      agentUserId: true,
    },
  });

  let pushed = 0;
  for (const tx of candidates) {
    const ownerId = tx.assignedUserId ?? tx.agentUserId;
    if (!ownerId || !tx.expectedExchangeDate) continue;

    // Dedup: skip if we've already written an exchange_approaching notification
    // for this transaction targeting the same exchange date.
    const dateKey = tx.expectedExchangeDate.toISOString().slice(0, 10);
    const existing = await prisma.notification.findFirst({
      where: {
        userId: ownerId,
        type: "exchange_approaching",
        transactionId: tx.id,
        payload: { path: ["dateKey"], equals: dateKey },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: ownerId,
        type: "exchange_approaching",
        transactionId: tx.id,
        payload: { dateKey, propertyAddress: tx.propertyAddress },
      },
    });

    const days = Math.round(
      (tx.expectedExchangeDate.getTime() - todayMs) / 86400000,
    );
    pushExchangeApproaching(tx.id, days).catch(() => {});
    pushed++;
  }

  return pushed;
}

// Daily mortgage-offer expiry sweep. Runs in the same morning cron pass. For
// every active, not-yet-exchanged file where a client entered a mortgage-offer
// expiry (the buyer's own, or the seller's onward-purchase offer), warns the
// file owner as it approaches — stepped so it can't quietly slip: a heads-up at
// 21 days, a sharper nudge at 7, and an escalation once it lapses. Each stage
// fires ONCE per offer date (dedup via a Notification keyed on date + stage).
// The push helper checks the owner's per-event toggle before firing.
type MortgageExpiryStage = "21" | "7" | "expired";

function mortgageExpiryStage(daysUntil: number): MortgageExpiryStage | null {
  if (daysUntil < 0) return "expired";
  if (daysUntil <= 7) return "7";
  if (daysUntil <= 21) return "21";
  return null;
}

export async function fireMortgageExpiryAlerts(agencyId: string): Promise<number> {
  const todayMs = new Date().setUTCHours(0, 0, 0, 0);

  const rows = await prisma.clientMoveInfo.findMany({
    where: {
      transaction: { agencyId, status: "active", exchangedAt: null },
      OR: [{ mortgageOfferExpiry: { not: null } }, { onwardMortgageOfferExpiry: { not: null } }],
    },
    select: {
      side: true,
      mortgageOfferExpiry: true,
      onwardMortgageOfferExpiry: true,
      transaction: { select: { id: true, propertyAddress: true, assignedUserId: true, agentUserId: true } },
    },
  });

  let fired = 0;
  for (const row of rows) {
    const ownerId = row.transaction.assignedUserId ?? row.transaction.agentUserId;
    if (!ownerId) continue;

    // The buyer's own offer lives on the purchaser row; the seller's onward
    // offer on the vendor row. Emit whichever this row carries.
    const offers: { side: "buyer" | "seller_onward"; date: Date }[] = [];
    if (row.side === "purchaser" && row.mortgageOfferExpiry) offers.push({ side: "buyer", date: row.mortgageOfferExpiry });
    if (row.side === "vendor" && row.onwardMortgageOfferExpiry) offers.push({ side: "seller_onward", date: row.onwardMortgageOfferExpiry });

    for (const offer of offers) {
      const daysUntil = Math.round((new Date(offer.date).setUTCHours(0, 0, 0, 0) - todayMs) / 86400000);
      const stage = mortgageExpiryStage(daysUntil);
      if (!stage) continue;

      const dateKey = offer.date.toISOString().slice(0, 10);
      const dedupeKey = `${offer.side}:${dateKey}:${stage}`;
      const existing = await prisma.notification.findFirst({
        where: {
          userId: ownerId,
          type: "mortgage_offer_expiring",
          transactionId: row.transaction.id,
          payload: { path: ["dedupeKey"], equals: dedupeKey },
        },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.notification.create({
        data: {
          userId: ownerId,
          type: "mortgage_offer_expiring",
          transactionId: row.transaction.id,
          payload: { dedupeKey, dateKey, stage, side: offer.side, daysUntil, propertyAddress: row.transaction.propertyAddress },
        },
      });
      pushMortgageOfferExpiring(row.transaction.id, offer.side, daysUntil).catch(() => {});
      fired++;
    }
  }

  return fired;
}
