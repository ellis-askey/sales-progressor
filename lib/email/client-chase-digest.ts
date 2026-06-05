// lib/email/client-chase-digest.ts
//
// B4 of the client-chase arc (Sub-arc B). Two exports:
//   1. assembleDigestPayload — pure function that turns a (transaction,
//      contact, due-milestones[]) into the { subject, text, html, unsubscribeUrl }
//      shape that OutboundEmailQueue payloads expect. Testable in isolation.
//   2. enqueueClientChaseDigest — calls (1), enqueues via A5's enqueueEmail
//      with recipientContactId set, then updates ClientChaseState for each
//      milestone in the digest (chaseCount++, lastChasedAt=now, firstChasedAt
//      if null). No real send here — drainOutboundQueue (cron at 09:00 UTC)
//      ships the queued row during business hours.
//
// NO PRODUCTION CALLERS in B4. B7's cron is the production wire-up. Until
// then this code is dormant and only exercised by scripts/verify-b4.ts.
//
// ────────────────────────────────────────────────────────────────────────────
// COPY: locked in the pre-B7 copy batch (surface 1 of 4). Three tones:
//   DIY    — every item is who:"you" (client confirms their own action)
//   NUDGE  — every item is who:"solicitor"|"lender" (third party owns it)
//   MIXED  — items span both categories
// NUDGE/MIXED further branches on the "sitting with" phrasing:
//   "your solicitor"            (all NUDGE items are who:"solicitor")
//   "your lender"               (all NUDGE items are who:"lender" — PM6/PM11)
//   "your solicitor or lender"  (mixed solicitor + lender NUDGE items)
// House style: calm, address-first subject, no em-dashes, no exclamation
// marks, no filler. The CTA is a single link (no per-item deep links —
// decided in the copy batch to keep the email a dumb text+link and let
// the page be authoritative on what's due).
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/email/outboundQueue";
import { recordEvent } from "@/lib/command/events/write";
import { buildContactUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { extractFirstName } from "@/lib/contacts/displayName";
import { applyChaseToTask } from "@/lib/services/reminders";

export type DigestMilestone = {
  code: string;
  // milestoneDefinitionId not required for assembly (we use code for client
  // copy lookup); reserved for B5's deep-link query param if we add it.
};

export type AssembleDigestInput = {
  transaction: { id: string; propertyAddress: string };
  contact: { id: string; name: string; portalToken: string };
  milestones: DigestMilestone[];
  // White-labelling: header label + sign-off come from the agency that
  // owns the file. Resolved by the caller via transaction.agency.name.
  agencyName: string;
  // Drives "your sale" vs "your purchase" in the body openers. A buyer
  // reading "things on your sale at X" hits a mental snag — they're
  // buying, not selling. Resolved by the caller via contact.roleType.
  recipientSide: "vendor" | "purchaser";
};

export type AssembledDigest = {
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl: string;
  respondUrl: string;
};

function portalBase(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

function shortAddress(propertyAddress: string): string {
  return propertyAddress.split(",")[0]?.trim() || propertyAddress;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Classifier: returns the tone of a single milestone code based on
// portal-copy.who. "you" → DIY; "solicitor"|"lender" → NUDGE. "agent"
// shouldn't reach the digest (A6 allowlist filters bilateral codes) but
// defensively classify as NUDGE so we never claim a client owns an action
// the agent owns.
type ItemTone = "diy" | "nudge";
type NudgeParty = "solicitor" | "lender";

function classifyTone(code: string): { tone: ItemTone; party: NudgeParty | null } {
  const who = getMilestoneCopy(code).who;
  if (who === "you") return { tone: "diy", party: null };
  if (who === "lender") return { tone: "nudge", party: "lender" };
  // "solicitor" | "agent" | anything else → NUDGE-solicitor
  return { tone: "nudge", party: "solicitor" };
}

// Returns the "sitting with" phrase for NUDGE / MIXED digests. Examines
// only the NUDGE items in the digest — DIY items don't contribute.
function sittingWithPhrase(nudgeParties: NudgeParty[]): string {
  const hasSolicitor = nudgeParties.includes("solicitor");
  const hasLender = nudgeParties.includes("lender");
  if (hasSolicitor && hasLender) return "your solicitor or lender";
  if (hasLender) return "your lender";
  return "your solicitor";
}

function withWhomPhrase(nudgeParties: NudgeParty[]): string {
  const hasSolicitor = nudgeParties.includes("solicitor");
  const hasLender = nudgeParties.includes("lender");
  if (hasSolicitor && hasLender) return "with your solicitor or lender";
  if (hasLender) return "with your lender";
  return "with your solicitor";
}

function nudgeBlockHeading(nudgeParties: NudgeParty[]): string {
  const hasSolicitor = nudgeParties.includes("solicitor");
  const hasLender = nudgeParties.includes("lender");
  if (hasSolicitor && hasLender) {
    return "With your solicitor and lender (no action needed unless you want to chase):";
  }
  if (hasLender) return "With your lender (no action needed unless you want to chase):";
  return "With your solicitor (no action needed unless you want to chase):";
}

export function assembleDigestPayload(input: AssembleDigestInput): AssembledDigest {
  const { transaction, contact, milestones, agencyName, recipientSide } = input;
  const base = portalBase();
  // "your sale" for vendors, "your purchase" for buyers. Single source of
  // truth used by every body opener so the voice never drifts back to
  // sale-only.
  const transactionWord = recipientSide === "purchaser" ? "purchase" : "sale";

  // Deep-link with milestone codes as a query-param hint. B5's respond page
  // reads ClientChaseState authoritatively, not this param — the param is
  // for click-analytics only. (Copy-batch decision: single link, no per-item
  // anchors — anchor-jumping is inconsistent across mobile clients.)
  const codes = milestones.map((m) => m.code).join(",");
  const respondUrl = `${base}/portal/${contact.portalToken}/respond?items=${encodeURIComponent(codes)}`;
  const unsubscribeUrl = buildContactUnsubscribeUrl(contact.id);

  const address = shortAddress(transaction.propertyAddress);
  const first = extractFirstName(contact.name);
  const count = milestones.length;

  // ─── Classify each item; split into DIY / NUDGE groups ──────────────────
  // Prefer chaseLabel where the copy defines it — it's phrased for the
  // chase opener ("sitting with your solicitor: <chaseLabel>" or
  // "Yours to do: <chaseLabel>"). Falls back to the canonical label
  // when chaseLabel is unset (i.e. milestones whose label already reads
  // naturally as an imperative action — VM1, VM4, VM6, etc).
  const diy: { code: string; label: string }[] = [];
  const nudge: { code: string; label: string; party: NudgeParty }[] = [];
  for (const m of milestones) {
    const { tone, party } = classifyTone(m.code);
    const copy = getMilestoneCopy(m.code);
    const label = copy.chaseLabel ?? copy.label;
    if (tone === "diy") {
      diy.push({ code: m.code, label });
    } else {
      nudge.push({ code: m.code, label, party: party ?? "solicitor" });
    }
  }
  const nudgeParties = Array.from(new Set(nudge.map((n) => n.party))) as NudgeParty[];

  const overallTone: "diy" | "nudge" | "mixed" =
    diy.length > 0 && nudge.length > 0 ? "mixed" : diy.length > 0 ? "diy" : "nudge";

  // ─── Subject (locked) ──────────────────────────────────────────────────
  const subject = count === 1
    ? `${address}: one update needed`
    : `${address}: ${count} updates needed`;

  // ─── Text body ─────────────────────────────────────────────────────────
  // Singular/plural as fixed strings (no template fragments — robust).
  const bulletLine = (label: string) => `  • ${label}`;

  let bodyLines: string[];

  if (overallTone === "diy") {
    const opener = count === 1
      ? `There's one thing on your ${transactionWord} at ${address} that only you can move forward:`
      : `There are ${count} things on your ${transactionWord} at ${address} that only you can move forward:`;
    bodyLines = [
      `Hi ${first},`,
      ``,
      opener,
      ``,
      ...diy.map((d) => bulletLine(d.label)),
      ``,
      `Open the page below to confirm each one is done, tell us a date you're expecting, or leave a quick note about why it's delayed. It takes about a minute.`,
      ``,
      respondUrl,
    ];
  } else if (overallTone === "nudge") {
    const phrase = sittingWithPhrase(nudgeParties);
    const opener = count === 1
      ? `One thing is sitting with ${phrase} right now that we haven't seen confirmed yet:`
      : `${count} things are sitting with ${phrase} right now that we haven't seen confirmed yet:`;
    bodyLines = [
      `Hi ${first},`,
      ``,
      `A quick update on your ${transactionWord} at ${address}.`,
      ``,
      opener,
      ``,
      ...nudge.map((n) => bulletLine(n.label)),
      ``,
      `You don't need to do anything yourself. If it's been a while and you want to chase, a short email often helps.`,
      ``,
      `If you've heard back and we just don't know yet, open the page below and let us know. We'll mark it done on our side so you don't get reminded again.`,
      ``,
      respondUrl,
    ];
  } else {
    // mixed
    const phrase = withWhomPhrase(nudgeParties);
    bodyLines = [
      `Hi ${first},`,
      ``,
      `A few updates on your ${transactionWord} at ${address}. Some of these are yours to do; the rest are ${phrase} and we're just flagging that we haven't seen them confirmed yet.`,
      ``,
      `Yours to do:`,
      ...diy.map((d) => bulletLine(d.label)),
      ``,
      nudgeBlockHeading(nudgeParties),
      ...nudge.map((n) => bulletLine(n.label)),
      ``,
      `Open the page below to confirm the items that are done, set an expected date, or leave a note for anything that's running late.`,
      ``,
      respondUrl,
    ];
  }

  const text = [
    ...bodyLines,
    ``,
    `Thanks,`,
    agencyName,
    ``,
    `If you'd rather we stop sending these, unsubscribe here:`,
    unsubscribeUrl,
  ].join("\n");

  // ─── HTML body ─────────────────────────────────────────────────────────
  // Same logical structure as the text body. Bullets are rendered as <ul>.
  const liStyle = `margin:0 0 6px;color:#1a1d29;font-size:14px;line-height:1.5;`;
  const pStyle = `font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 16px;`;
  const headingStyle = `font-size:15px;color:#1a1d29;font-weight:600;line-height:1.5;margin:0 0 8px;`;
  const renderList = (items: { label: string }[]) =>
    `<ul style="margin:0 0 20px;padding-left:20px;">\n` +
    items.map((i) => `        <li style="${liStyle}">${escapeHtml(i.label)}</li>`).join("\n") +
    `\n      </ul>`;

  let htmlInner: string;

  if (overallTone === "diy") {
    const opener = count === 1
      ? `There's one thing on your ${transactionWord} at <strong>${escapeHtml(address)}</strong> that only you can move forward:`
      : `There are ${count} things on your ${transactionWord} at <strong>${escapeHtml(address)}</strong> that only you can move forward:`;
    htmlInner = `
          <p style="${pStyle}">Hi ${escapeHtml(first)},</p>
          <p style="${pStyle}">${opener}</p>
          ${renderList(diy)}
          <p style="${pStyle}">Open the page below to confirm each one is done, tell us a date you're expecting, or leave a quick note about why it's delayed. It takes about a minute.</p>`;
  } else if (overallTone === "nudge") {
    const phrase = escapeHtml(sittingWithPhrase(nudgeParties));
    const opener = count === 1
      ? `One thing is sitting with ${phrase} right now that we haven't seen confirmed yet:`
      : `${count} things are sitting with ${phrase} right now that we haven't seen confirmed yet:`;
    htmlInner = `
          <p style="${pStyle}">Hi ${escapeHtml(first)},</p>
          <p style="${pStyle}">A quick update on your ${transactionWord} at <strong>${escapeHtml(address)}</strong>.</p>
          <p style="${pStyle}">${opener}</p>
          ${renderList(nudge)}
          <p style="${pStyle}">You don't need to do anything yourself. If it's been a while and you want to chase, a short email often helps.</p>
          <p style="${pStyle}">If you've heard back and we just don't know yet, open the page below and let us know. We'll mark it done on our side so you don't get reminded again.</p>`;
  } else {
    // mixed
    const phrase = escapeHtml(withWhomPhrase(nudgeParties));
    htmlInner = `
          <p style="${pStyle}">Hi ${escapeHtml(first)},</p>
          <p style="${pStyle}">A few updates on your ${transactionWord} at <strong>${escapeHtml(address)}</strong>. Some of these are yours to do; the rest are ${phrase} and we're just flagging that we haven't seen them confirmed yet.</p>
          <p style="${headingStyle}">Yours to do:</p>
          ${renderList(diy)}
          <p style="${headingStyle}">${escapeHtml(nudgeBlockHeading(nudgeParties))}</p>
          ${renderList(nudge)}
          <p style="${pStyle}">Open the page below to confirm the items that are done, set an expected date, or leave a note for anything that's running late.</p>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">${escapeHtml(agencyName)}</p>${htmlInner}
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="border-radius:8px;background:#FF6B4A;">
              <a href="${respondUrl}" style="display:inline-block;padding:12px 24px;color:white;text-decoration:none;font-weight:500;font-size:15px;">Open the page</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#c0c4d0;text-align:center;">
        <a href="${unsubscribeUrl}" style="color:#c0c4d0;text-decoration:none;">Unsubscribe</a> &nbsp;&middot;&nbsp;
        <a href="mailto:support@thesalesprogressor.co.uk" style="color:#c0c4d0;text-decoration:none;">support@thesalesprogressor.co.uk</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html, unsubscribeUrl, respondUrl };
}

// ─── enqueueClientChaseDigest ───────────────────────────────────────────────
// Looks up the transaction + contact, builds the digest payload, enqueues
// via A5's enqueueEmail with recipientContactId set, then updates
// ClientChaseState for each milestone:
//   - chaseCount++
//   - lastChasedAt = now
//   - firstChasedAt set if null (the "silence clock starts here" anchor)
//
// sourceId pattern: ${transactionId}:${contactId}:${YYYY-MM-DD-UTC}
//   — one digest per (transaction, contact) per UTC day. The
//   OutboundEmailQueue unique partial-index on (emailType, sourceId,
//   recipientContactId) dedups repeat enqueues for the same day. A new
//   day means a new sourceId means a new enqueue is allowed.
//
// Returns null if the contact wasn't found (defensive — the cron would
// already have filtered, but a race between cron and contact deletion is
// possible). Otherwise returns the queued row's id.

export async function enqueueClientChaseDigest(input: {
  transactionId: string;
  contactId: string;
  milestoneCodes: string[];
}): Promise<{ enqueued: boolean; rowId: string | null }> {
  const { transactionId, contactId, milestoneCodes } = input;
  if (milestoneCodes.length === 0) {
    return { enqueued: false, rowId: null };
  }

  // Pull everything in one round-trip-ish — the assembler is pure so we
  // hand it resolved data. Agency name is pulled in for white-labelled
  // header + sign-off (replaces "Sales Progressor" branding).
  const [transaction, contact] = await Promise.all([
    prisma.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        propertyAddress: true,
        agency: { select: { name: true } },
        // Phase 1 commit 4c: needed by the ClientChaseState upsert
        // below so purchaser-contact rows get round-stamped.
        activeBuyerRoundId: true,
      },
    }),
    prisma.contact.findUnique({
      where: { id: contactId },
      select: { id: true, name: true, portalToken: true, email: true, unsubscribedAt: true, roleType: true },
    }),
  ]);

  if (!transaction || !contact) return { enqueued: false, rowId: null };
  // Sanity: contact must have email + portalToken at THIS layer. The cron
  // is supposed to gate on these via the fail-soft helper (no_email,
  // no_portalToken kinds) before calling here, but defence-in-depth.
  if (!contact.email || !contact.portalToken) return { enqueued: false, rowId: null };
  // Don't enqueue to opted-out contacts. Drain would skip them anyway, but
  // shortest-path: don't even queue.
  if (contact.unsubscribedAt) return { enqueued: false, rowId: null };

  const payload = assembleDigestPayload({
    transaction: { id: transaction.id, propertyAddress: transaction.propertyAddress },
    contact: { id: contact.id, name: contact.name, portalToken: contact.portalToken },
    milestones: milestoneCodes.map((code) => ({ code })),
    agencyName: transaction.agency?.name ?? "Sales Progressor",
    // Drives sale/purchase word in the body openers. Defaults to vendor
    // defensively — should never apply since the cron filters contacts
    // to vendor/purchaser only before reaching this path.
    recipientSide: contact.roleType === "purchaser" ? "purchaser" : "vendor",
  });

  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const sourceId = `${transactionId}:${contactId}:${yyyymmdd}`;

  // Enqueue. A5's enqueueEmail handles the dedup (P2002 swallowed). If a
  // digest already exists for this (transaction, contact, day) the second
  // call no-ops silently.
  await enqueueEmail({
    emailType: "CLIENT_CHASE",
    sourceId,
    recipientEmail: contact.email,
    recipientContactId: contact.id,
    payload: {
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    },
  });

  // Look up the queue row we just created (or that already existed via
  // dedup). The unique constraint guarantees at most one.
  const row = await prisma.outboundEmailQueue.findFirst({
    where: {
      emailType: "CLIENT_CHASE",
      sourceId,
      recipientContactId: contact.id,
    },
    select: { id: true },
  });
  if (!row) return { enqueued: false, rowId: null };

  // Command Centre event log. The (transaction, contact, day) row is dedup-
  // unique at the queue level via P2002, but if the cron re-invokes this
  // function for the same tuple later in the day the recordEvent call below
  // could fire again citing the same entityId. Downstream consumers should
  // dedupe by (type, entityId, DATE(createdAt)) when exact-once counting is
  // needed. We're not adding a guard query here per the additive-only rule.
  await recordEvent({
    type: "chase_message_generated",
    entityType: "OutboundEmailQueue",
    entityId: row.id,
    metadata: {
      transactionId,
      contactId,
      milestoneCodes,
      recipientSide: contact.roleType === "purchaser" ? "purchaser" : "vendor",
    },
  });

  // Update ClientChaseState for each milestone in the digest. Upsert so the
  // first chase for a (transaction, contact, milestone) tuple creates the
  // row; subsequent chases bump chaseCount + lastChasedAt.
  //
  // Phase 1 commit 4c attribution: stamp the active round on rows where
  // the contact is a purchaser (Phase 0 backfill rule). Vendor and
  // solicitor rows stay file-level. Read activeBuyerRoundId off the
  // transaction parameter rather than re-fetching — the caller already
  // selected it (or, for callers that don't, we degrade to null which
  // is the file-level / legacy behaviour).
  const activeBuyerRoundId =
    (transaction as { activeBuyerRoundId?: string | null }).activeBuyerRoundId ?? null;
  const stampRoundId = contact.roleType === "purchaser" ? activeBuyerRoundId : null;

  const now = new Date();
  for (const code of milestoneCodes) {
    await prisma.clientChaseState.upsert({
      where: {
        transactionId_contactId_milestoneCode: {
          transactionId,
          contactId,
          milestoneCode: code,
        },
      },
      create: {
        transactionId,
        contactId,
        milestoneCode: code,
        chaseCount: 1,
        firstChasedAt: now,
        lastChasedAt: now,
        status: "active",
        buyerRoundId: stampRoundId,
      },
      update: {
        chaseCount: { increment: 1 },
        lastChasedAt: now,
        // firstChasedAt set only on create — never overwrite
      },
    });
  }

  // Honest-chase-count: an enqueued client digest is a real chase from the
  // agent's POV. Apply the same write the manual "Chased" button uses, via
  // applyChaseToTask. That helper bumps chaseCount, stamps lastChasedAt,
  // resets priority to normal, AND advances the ReminderLog.nextDueDate
  // forward by repeatEveryDays — all in one atomic transaction.
  //
  // Pre-2026-06-03 this path used a raw chaseTask.updateMany that only
  // touched the task; the underlying ReminderLog.nextDueDate stayed put,
  // so the agent saw a "due today" row in the work queue even when the
  // auto-chase had already gone out that morning. Bug surfaced via Ellis
  // hitting the file at 09:00 to find it still flagged as needing a chase.
  //
  // We resolve ChaseTask via ReminderLog → ReminderRule → targetMilestoneCode.
  // Only pending tasks advance; cancelled/done are left alone.
  if (milestoneCodes.length > 0) {
    const pendingTasks = await prisma.chaseTask.findMany({
      where: {
        transactionId,
        status: "pending",
        reminderLog: {
          reminderRule: { targetMilestoneCode: { in: milestoneCodes } },
        },
      },
      select: { id: true },
    });
    for (const task of pendingTasks) {
      await applyChaseToTask(task.id);
    }
  }

  return { enqueued: true, rowId: row.id };
}
