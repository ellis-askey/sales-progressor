/**
 * Retention email service for Sales Progressor.
 *
 * Two entry points:
 *   maybeFireFirstExchangeEmail  — called after exchange milestone commits
 *   runRetentionEmailSweep       — daily cron sweep for all other emails
 *
 * Hard constraints:
 *   - All sends go via lib/email.ts (existing SendGrid pipeline)
 *   - Reply-to is always inbox@thesalesprogressor.co.uk
 *   - From-address is updates@thesalesprogressor.co.uk (DEFAULT_FROM in lib/email.ts)
 *   - retentionEmailOptOut skips emails 4, 5, 6 only (1, 2, 3 are transactional)
 *   - RetentionEmailLog row written on success only — never on failure
 */

import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { extractFirstName } from "@/lib/contacts/displayName";
import {
  buildRetentionEmail,
  type RetentionEmailKey,
  TRANSACTIONAL_EMAIL_KEYS,
} from "@/lib/emails/retention";

const REPLY_TO = "inbox@thesalesprogressor.co.uk";
const SYSTEM_FROM_DOMAIN = "updates@thesalesprogressor.co.uk";

// ─── Token helpers ────────────────────────────────────────────────────────────

function signToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(userId).digest("hex") + "." + userId;
}

function verifyToken(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  const sig = token.slice(0, dotIndex);
  const userId = token.slice(dotIndex + 1);
  if (!userId) return null;
  const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "")
    .update(userId)
    .digest("hex");
  return sig === expected ? userId : null;
}

export { verifyToken };

export function generateUnsubscribeUrl(userId: string): string {
  const token = signToken(userId);
  const base = process.env.NEXTAUTH_URL ?? "";
  return `${base}/api/retention/unsubscribe?token=${token}`;
}

// ─── Internal send helper ─────────────────────────────────────────────────────

async function sendRetentionEmail({
  user,
  emailKey,
  vars,
}: {
  user: { id: string; email: string; name: string; agencyId: string | null };
  emailKey: RetentionEmailKey;
  vars: {
    address?: string;
    ctaUrl?: string;
    unsubscribeUrl?: string;
  };
}): Promise<void> {
  const firstName = extractFirstName(user.name);
  const unsubscribeUrl = generateUnsubscribeUrl(user.id);

  const template = buildRetentionEmail(emailKey, {
    firstName,
    address: vars.address,
    ctaUrl: vars.ctaUrl,
    unsubscribeUrl: vars.unsubscribeUrl ?? unsubscribeUrl,
  });

  const from = `${template.fromDisplayName} <${SYSTEM_FROM_DOMAIN}>`;

  await sendEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    from,
    replyTo: REPLY_TO,
  });

  // Write log row only after successful send
  await prisma.retentionEmailLog.create({
    data: {
      userId: user.id,
      emailKey,
      agencyId: user.agencyId ?? "",
    },
  });
}

// ─── 3a. Event-triggered — first exchange ────────────────────────────────────

/**
 * Called after exchange milestones (VM19 or PM26) commit.
 * Fires the `first_exchange` email if this user has never received it before.
 * Ignores retentionEmailOptOut — this is transactional/celebration.
 */
export async function maybeFireFirstExchangeEmail(
  userId: string,
  transactionId: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, agencyId: true },
    });
    if (!user?.email) return;

    // Check if user already received first_exchange
    const existing = await prisma.retentionEmailLog.findFirst({
      where: { userId, emailKey: "first_exchange" },
      select: { id: true },
    });
    if (existing) return;

    // Verify the transaction belongs to this user and has an exchange milestone
    const tx = await prisma.propertyTransaction.findFirst({
      where: {
        id: transactionId,
        OR: [{ agentUserId: userId }, { assignedUserId: userId }],
      },
      select: { id: true, propertyAddress: true },
    });
    if (!tx) return;

    const base = process.env.NEXTAUTH_URL ?? "";
    const ctaUrl = `${base}/transactions/${transactionId}`;

    await sendRetentionEmail({
      user,
      emailKey: "first_exchange",
      vars: { address: tx.propertyAddress, ctaUrl },
    });
  } catch (err) {
    console.error("[retention] maybeFireFirstExchangeEmail error:", err);
  }
}

// ─── 3b. Daily sweep ──────────────────────────────────────────────────────────

type SweepResult = { sent: number; skipped: number; errors: number };

const CHUNK_SIZE = 25;

async function chunkSend(
  candidates: Array<{ id: string; email: string; name: string; agencyId: string | null }>,
  emailKey: RetentionEmailKey,
  getVars: (u: { id: string; email: string; name: string; agencyId: string | null }) => {
    address?: string;
    ctaUrl?: string;
    unsubscribeUrl?: string;
  }
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((u) =>
        sendRetentionEmail({ user: u, emailKey, vars: getVars(u) })
          .then(() => true)
          .catch((err) => {
            console.error(`[retention] failed to send ${emailKey} to ${u.id}:`, err);
            return false;
          })
      )
    );
    for (const ok of results) {
      if (ok) sent++;
      else errors++;
    }
  }
  return { sent, errors };
}

/**
 * Daily sweep — evaluates all users and sends one email per user per run
 * (highest-priority qualifying email only).
 *
 * Priority order (highest first):
 *   last_touch_60d → send_to_us_drop_21d → quiet_30d → stuck_day_3 → activation_day_1
 */
export async function runRetentionEmailSweep(): Promise<SweepResult> {
  const base = process.env.NEXTAUTH_URL ?? "";
  const now = new Date();

  const days = (n: number) => new Date(now.getTime() - n * 86400000);

  let totalSent = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Track which users have already been assigned an email this run, to enforce
  // the "one email per user per run" rule across priority bands.
  const assignedUserIds = new Set<string>();

  // Helper: get users who have NOT yet received a given emailKey
  // and have NOT been assigned an email this run
  async function getEligibleBase(emailKey: RetentionEmailKey, allowOptOut: boolean) {
    const isTransactional = (TRANSACTIONAL_EMAIL_KEYS as string[]).includes(emailKey);

    const users = await prisma.user.findMany({
      where: {
        agencyId: { not: null },
        email: { not: "" },
        ...(isTransactional || allowOptOut ? {} : { retentionEmailOptOut: false }),
        NOT: {
          retentionEmailLogs: { some: { emailKey } },
        },
      },
      select: { id: true, email: true, name: true, agencyId: true },
    });
    return users.filter((u) => !assignedUserIds.has(u.id));
  }

  // ── Priority 1: last_touch_60d ──────────────────────────────────────────────
  {
    const emailKey: RetentionEmailKey = "last_touch_60d";
    const cutoff60d = days(60);
    const cutoff30d = days(30);

    // Candidates: most recent transaction created 60+ days ago AND user has received
    // quiet_30d or send_to_us_drop_21d AND no new file since that earlier email
    const eligible = await getEligibleBase(emailKey, false);

    const candidates: typeof eligible = [];
    for (const user of eligible) {
      // Most recent transaction for this agent
      const latestTx = await prisma.propertyTransaction.findFirst({
        where: { agentUserId: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (!latestTx || latestTx.createdAt > cutoff60d) continue;

      // Must have received quiet_30d or send_to_us_drop_21d
      const priorEmail = await prisma.retentionEmailLog.findFirst({
        where: { userId: user.id, emailKey: { in: ["quiet_30d", "send_to_us_drop_21d"] } },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      });
      if (!priorEmail) continue;

      // No new file created in the 30+ days since that earlier email
      const newFileSinceEmail = await prisma.propertyTransaction.findFirst({
        where: { agentUserId: user.id, createdAt: { gte: priorEmail.sentAt } },
        select: { id: true },
      });
      if (newFileSinceEmail) continue;

      // Also verify no file in last 30d
      const recentFile = await prisma.propertyTransaction.findFirst({
        where: { agentUserId: user.id, createdAt: { gte: cutoff30d } },
        select: { id: true },
      });
      if (recentFile) continue;

      candidates.push(user);
    }

    const { sent, errors } = await chunkSend(candidates, emailKey, (u) => ({
      ctaUrl: `${base}/login`,
      unsubscribeUrl: generateUnsubscribeUrl(u.id),
    }));

    totalSent += sent;
    totalErrors += errors;
    totalSkipped += candidates.length - sent - errors;
    for (const u of candidates) assignedUserIds.add(u.id);
  }

  // ── Priority 2: send_to_us_drop_21d ────────────────────────────────────────
  {
    const emailKey: RetentionEmailKey = "send_to_us_drop_21d";
    const cutoff21d = days(21);

    // Candidates: user has at least 1 outsourced transaction AND most recent tx 21+ days ago
    const eligible = await getEligibleBase(emailKey, false);

    const candidates: typeof eligible = [];
    for (const user of eligible) {
      // Must have at least one outsourced file
      const outsourcedFile = await prisma.propertyTransaction.findFirst({
        where: { agentUserId: user.id, serviceType: "outsourced" },
        select: { id: true },
      });
      if (!outsourcedFile) continue;

      // Most recent transaction for this agent
      const latestTx = await prisma.propertyTransaction.findFirst({
        where: { agentUserId: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (!latestTx || latestTx.createdAt > cutoff21d) continue;

      candidates.push(user);
    }

    const { sent, errors } = await chunkSend(candidates, emailKey, (u) => ({
      unsubscribeUrl: generateUnsubscribeUrl(u.id),
    }));

    totalSent += sent;
    totalErrors += errors;
    totalSkipped += candidates.length - sent - errors;
    for (const u of candidates) assignedUserIds.add(u.id);
  }

  // ── Priority 3: quiet_30d ───────────────────────────────────────────────────
  {
    const emailKey: RetentionEmailKey = "quiet_30d";
    const cutoff30d = days(30);

    // Candidates: 3+ transactions total AND most recent tx 30+ days ago
    const eligible = await getEligibleBase(emailKey, false);

    const candidates: typeof eligible = [];
    for (const user of eligible) {
      const txCount = await prisma.propertyTransaction.count({
        where: { agentUserId: user.id },
      });
      if (txCount < 3) continue;

      const latestTx = await prisma.propertyTransaction.findFirst({
        where: { agentUserId: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (!latestTx || latestTx.createdAt > cutoff30d) continue;

      candidates.push(user);
    }

    const { sent, errors } = await chunkSend(candidates, emailKey, (u) => ({
      ctaUrl: `${base}/transactions/new`,
      unsubscribeUrl: generateUnsubscribeUrl(u.id),
    }));

    totalSent += sent;
    totalErrors += errors;
    totalSkipped += candidates.length - sent - errors;
    for (const u of candidates) assignedUserIds.add(u.id);
  }

  // ── Priority 4: stuck_day_3 ─────────────────────────────────────────────────
  {
    const emailKey: RetentionEmailKey = "stuck_day_3";
    const cutoff3d = days(3);

    // Candidates: at least 1 transaction, oldest created 3+ days ago, zero complete milestones
    // stuck_day_3 is transactional — send regardless of opt-out
    const eligible = await getEligibleBase(emailKey, true);

    const candidates: typeof eligible = [];
    const candidateAddresses: Map<string, string> = new Map();
    const candidateTransactionIds: Map<string, string> = new Map();

    for (const user of eligible) {
      // Oldest transaction for this agent must be 3+ days old
      const oldestTx = await prisma.propertyTransaction.findFirst({
        where: { agentUserId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, createdAt: true, propertyAddress: true },
      });
      if (!oldestTx || oldestTx.createdAt > cutoff3d) continue;

      // Zero complete milestone completions on any of this user's transactions
      const agentTxIds = await prisma.propertyTransaction.findMany({
        where: { agentUserId: user.id },
        select: { id: true },
      });
      const txIds = agentTxIds.map((t) => t.id);
      if (txIds.length === 0) continue;

      const completionCount = await prisma.milestoneCompletion.count({
        where: { transactionId: { in: txIds }, state: "complete" },
      });
      if (completionCount > 0) continue;

      candidates.push(user);
      candidateAddresses.set(user.id, oldestTx.propertyAddress);
      candidateTransactionIds.set(user.id, oldestTx.id);
    }

    const { sent, errors } = await chunkSend(candidates, emailKey, (u) => ({
      address: candidateAddresses.get(u.id),
      ctaUrl: `${base}/transactions/${candidateTransactionIds.get(u.id) ?? ""}`,
    }));

    totalSent += sent;
    totalErrors += errors;
    totalSkipped += candidates.length - sent - errors;
    for (const u of candidates) assignedUserIds.add(u.id);
  }

  // ── Priority 5: activation_day_1 ───────────────────────────────────────────
  {
    const emailKey: RetentionEmailKey = "activation_day_1";
    const cutoff1d = days(1);

    // Candidates: zero transactions AND account created 1+ days ago
    // activation_day_1 is transactional — send regardless of opt-out
    const eligible = await getEligibleBase(emailKey, true);

    const candidates: typeof eligible = [];
    for (const user of eligible) {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { createdAt: true },
      });
      if (!userData || userData.createdAt > cutoff1d) continue;

      const txCount = await prisma.propertyTransaction.count({
        where: { agentUserId: user.id },
      });
      if (txCount > 0) continue;

      candidates.push(user);
    }

    const { sent, errors } = await chunkSend(candidates, emailKey, () => ({
      ctaUrl: `${base}/transactions/new`,
    }));

    totalSent += sent;
    totalErrors += errors;
    totalSkipped += candidates.length - sent - errors;
    for (const u of candidates) assignedUserIds.add(u.id);
  }

  return { sent: totalSent, skipped: totalSkipped, errors: totalErrors };
}
