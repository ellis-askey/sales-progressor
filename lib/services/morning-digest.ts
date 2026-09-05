import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { resolveAgencySender } from "@/lib/email/agency-sender";
import { toUKDateStr } from "@/lib/utils";
import { getNotificationPrefsForUsers } from "@/lib/agent/notification-prefs";
import { pushExchangeApproaching, pushMortgageOfferExpiring } from "@/lib/agent/push-events";
import { possessiveClientLabel } from "@/lib/updates-copy";
import { extractFirstName } from "@/lib/contacts/displayName";
import { buildMorningBrief } from "@/lib/emails/morning-brief";

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
    select: { id: true, name: true, email: true, role: true },
  });

  const results: ProgressorDigest[] = [];

  for (const user of progressors) {
    if (!user.email) continue;

    // A director is an agency user — never chase them about a TSP-managed file
    // (our team runs those). Internal progressors/admins still see everything.
    const excludeManaged = user.role === "director";
    const transactions = await prisma.propertyTransaction.findMany({
      where: {
        agencyId,
        assignedUserId: user.id,
        status: "active",
        ...(excludeManaged ? { serviceType: { not: "outsourced" } } : {}),
      },
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
  const base = process.env.NEXTAUTH_URL ?? "";
  const CAP = 8; // rows per section; the rest roll into a "+N more" link

  // "8 Birchwood Close, Guildford, GU1 3RF" → line 1 street, line 2 the rest.
  const splitAddr = (a: string): { l1: string; l2?: string } => {
    const i = a.indexOf(",");
    return i === -1 ? { l1: a } : { l1: a.slice(0, i).trim(), l2: a.slice(i + 1).trim() };
  };
  const fileVars = (f: DigestFile, items: { label: string; detail?: string }[]) => {
    const { l1, l2 } = splitAddr(f.address);
    return { addressLine1: l1, addressLine2: l2, url: `${base}/transactions/${f.id}`, items };
  };

  for (const d of digests) {
    if (prefsByUser.get(d.userId)?.morningDigest === false) continue;

    const overdueTx    = d.files.filter((f) => f.overdueChases > 0);
    const dueTodayTx   = d.files.filter((f) => f.dueToday > 0 && f.overdueChases === 0);
    const exchangeSoon = d.files.filter(
      (f) => f.exchangeTarget && daysUntil(f.exchangeTarget) >= 0 && daysUntil(f.exchangeTarget) <= 14
    );
    const totalActions = d.files.reduce((s, f) => s + f.overdueChases + f.dueToday, 0);

    // count = true total (drives the header + "+N more"); files = capped rows.
    const groups = [
      overdueTx.length > 0
        ? {
            kind: "attention" as const,
            count: overdueTx.length,
            files: overdueTx.slice(0, CAP).map((f) =>
              fileVars(f, [{ label: `${f.overdueChases} chase${f.overdueChases !== 1 ? "s" : ""} overdue` }]),
            ),
          }
        : null,
      dueTodayTx.length > 0
        ? {
            kind: "today" as const,
            count: dueTodayTx.length,
            files: dueTodayTx.slice(0, CAP).map((f) =>
              fileVars(f, [{ label: `${f.dueToday} action${f.dueToday !== 1 ? "s" : ""} due today` }]),
            ),
          }
        : null,
      exchangeSoon.length > 0
        ? {
            kind: "upcoming" as const,
            count: exchangeSoon.length,
            files: exchangeSoon.slice(0, CAP).map((f) => {
              const days = daysUntil(f.exchangeTarget!);
              return fileVars(f, [
                { label: "Exchange target", detail: `${fmtDate(f.exchangeTarget!)}${days === 0 ? " · today" : ` · ${days}d`}` },
              ]);
            }),
          }
        : null,
    ].filter((g): g is NonNullable<typeof g> => g !== null);

    const built = buildMorningBrief({
      firstName: extractFirstName(d.name),
      activeSales: d.activeCount,
      actionsDue: totalActions,
      groups,
      openUrl: `${base}/agent/hub`,
      unsubscribeUrl: `${base}/agent/account/notifications`,
    });

    await sendAgentEmail({
      to: d.email,
      subject: built.subject,
      text: built.text,
      html: built.html,
      from: fromAddr,
      replyTo,
      kind: "morning_digest",
      userId: d.userId,
      agencyId,
    }).catch(() => {});
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
      transaction: {
        select: {
          id: true, propertyAddress: true, assignedUserId: true, agentUserId: true,
          contacts: { select: { name: true, roleType: true } },
        },
      },
    },
  });

  let fired = 0;
  for (const row of rows) {
    const ownerId = row.transaction.assignedUserId ?? row.transaction.agentUserId;
    if (!ownerId) continue;

    // The buyer's own offer lives on the purchaser row; the seller's onward
    // offer on the vendor row. Emit whichever this row carries. The client
    // label names the people whose offer it is (buyer for their own, seller for
    // an onward), so the alert reads "Ben and Molly's" not "the buyer's".
    const offers: { side: "buyer" | "seller_onward"; date: Date }[] = [];
    if (row.side === "purchaser" && row.mortgageOfferExpiry) offers.push({ side: "buyer", date: row.mortgageOfferExpiry });
    if (row.side === "vendor" && row.onwardMortgageOfferExpiry) offers.push({ side: "seller_onward", date: row.onwardMortgageOfferExpiry });

    for (const offer of offers) {
      const daysUntil = Math.round((new Date(offer.date).setUTCHours(0, 0, 0, 0) - todayMs) / 86400000);
      const stage = mortgageExpiryStage(daysUntil);
      if (!stage) continue;

      const contactRole = offer.side === "buyer" ? "purchaser" : "vendor";
      const names = row.transaction.contacts.filter((c) => c.roleType === contactRole).map((c) => c.name);
      const clientLabel = possessiveClientLabel(names, offer.side === "buyer" ? "The buyer's" : "The seller's");

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
          payload: { dedupeKey, dateKey, stage, side: offer.side, daysUntil, clientLabel, propertyAddress: row.transaction.propertyAddress },
        },
      });
      pushMortgageOfferExpiring(row.transaction.id, offer.side, daysUntil, clientLabel).catch(() => {});
      fired++;
    }
  }

  return fired;
}
