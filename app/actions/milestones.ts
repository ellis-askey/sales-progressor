"use server";

import { revalidatePath } from "next/cache";

function revalidateTx(id: string) {
  revalidatePath(`/transactions/${id}`, "page");
  revalidatePath(`/agent/transactions/${id}`, "page");
}
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import type { PurchaseType } from "@prisma/client";
import {
  completeMilestone,
  markNotRequiredWithCascade,
  reverseMilestoneWithCascade,
  getUndoImpact,
  executeUndoMilestone,
} from "@/lib/services/milestones";
export type { UndoImpact, UndoImpactItem } from "@/lib/services/milestones";
import { pushToTransaction } from "@/lib/services/push";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { sendAdminMilestoneNotificationToPortal } from "@/lib/services/portal";
import { getDisplayName } from "@/lib/contacts/displayName";
import { maybeFireFirstExchangeEmail } from "@/lib/services/retention";

export type NotificationStatus = {
  role: "seller" | "buyer" | "agent" | "progressor";
  contactId: string | null;
  contactDisplayName: string;
  status: "queued" | "skipped_no_email" | "skipped_no_contact";
};

/**
 * Confirm a milestone (and any implied predecessors) for a transaction.
 * Equivalent to POST /api/milestones { action: "complete" } but runs as a
 * Server Action so Next.js automatically invalidates the Router Cache and
 * re-renders the page without a client-side router.refresh().
 *
 * The Route Handler at /api/milestones is kept alive for non-React callers.
 * Both paths call the same service functions — no business logic here.
 */
export async function confirmMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, propertyAddress: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });

  // Resolve counterpart definition id before the transaction (read-only lookup)
  const BILATERAL_PAIRS: Record<string, string> = {
    VM19: "PM26", PM26: "VM19",
    VM20: "PM27", PM27: "VM20",
  };
  const counterCode = def?.code ? BILATERAL_PAIRS[def.code] : undefined;
  let counterDefId: string | undefined;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    counterDefId = counterDef?.id;
  }

  // Primary + bilateral counterpart writes in a single atomic transaction
  const result = await prisma.$transaction(async (ptx) => {
    const primary = await completeMilestone({
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      completedById: session.user.id,
      completedByName: session.user.name ?? "",
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
    }, ptx);

    if (counterDefId) {
      const alreadyDone = await ptx.milestoneCompletion.findFirst({
        where: { transactionId: input.transactionId, milestoneDefinitionId: counterDefId, state: "complete" },
      });
      if (!alreadyDone) {
        await completeMilestone({
          transactionId: input.transactionId,
          milestoneDefinitionId: counterDefId,
          completedById: session.user.id,
          completedByName: session.user.name ?? "",
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
        }, ptx);
      }
    }

    // Exchange Forecast sync: lock in confirmed exchange date
    if ((def?.code === "VM19" || def?.code === "PM26") && input.eventDate) {
      await ptx.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { expectedExchangeDate: new Date(input.eventDate) },
      });
    }

    return primary;
  });

  // Single revalidate after all DB writes (primary + bilateral counterpart)
  revalidateTx(input.transactionId);
  revalidatePath("/portal", "layout");

  // Completion: sync the transaction completionDate if the confirmed date differs
  if ((def?.code === "VM20" || def?.code === "PM27") && input.eventDate) {
    const actualDate = new Date(input.eventDate);
    const txData = await prisma.propertyTransaction.findFirst({
      where: { id: input.transactionId },
      select: { completionDate: true },
    });
    const existingDate = txData?.completionDate;
    const dateMismatch = !existingDate ||
      Math.abs(actualDate.getTime() - existingDate.getTime()) > 12 * 3600 * 1000; // >12h apart
    if (dateMismatch) {
      await prisma.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { completionDate: actualDate },
      });
      revalidateTx(input.transactionId);
    }
  }

  // Push to subscribed portal contacts (fire-and-forget)
  if (def) {
    const code  = def.code;
    const label = getMilestoneCopy(code).label;
    const short = tx.propertyAddress.split(",")[0];

    let title = "Progress update";
    let body  = `${short} — "${label}" is complete.`;

    if (code === "VM19" || code === "PM26") {
      title = "Contracts exchanged!";
      body  = `${short} — your transaction is now legally committed.`;
    } else if (code === "VM20" || code === "PM27") {
      title = "Completed!";
      body  = `${short} — congratulations, your transaction has completed.`;
    } else if (code === "VM18" || code === "PM25") {
      title = "Ready to exchange";
      body  = `${short} — your solicitor has confirmed everything is in place.`;
    } else if (input.eventDate) {
      const fmtDate = new Date(input.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      title = `Date confirmed — ${short}`;
      body  = `${label}: ${fmtDate}`;
    }

    pushToTransaction(input.transactionId, {
      title,
      body,
      urlPath: "/progress",
    }).catch(() => {});

    // Email all vendor/purchaser portal contacts with a translated progress update
    sendAdminMilestoneNotificationToPortal(
      input.transactionId,
      code,
      input.eventDate ?? null
    ).catch(() => {});

    // Retention email: fire first-exchange celebration for the agent who owns the file
    if (code === "VM19" || code === "PM26") {
      maybeFireFirstExchangeEmail(session.user.id, input.transactionId).catch(() => {});
    }
  }

  // Build intent-based notification status (check email addresses without blocking on send)
  const notifications: NotificationStatus[] = [];
  if (def) {
    const emailCopy = getMilestoneCopy(def.code).emailCopy ?? {};
    const notifTx = await prisma.propertyTransaction.findUnique({
      where: { id: input.transactionId },
      select: {
        assignedUser: { select: { id: true, name: true, email: true } },
        agentUser:    { select: { id: true, name: true, email: true } },
        contacts: {
          where: { roleType: { in: ["vendor", "purchaser"] } },
          select: { id: true, name: true, email: true, roleType: true },
        },
      },
    });
    if (notifTx) {
      for (const c of notifTx.contacts) {
        const role = c.roleType as "vendor" | "purchaser";
        if (!emailCopy[role]) continue;
        notifications.push({
          role: role === "vendor" ? "seller" : "buyer",
          contactId: c.id,
          contactDisplayName: getDisplayName({ name: c.name }),
          status: c.email ? "queued" : "skipped_no_email",
        });
      }
      if (emailCopy.vendorAgent) {
        if (notifTx.agentUser) {
          notifications.push({
            role: "agent",
            contactId: null,
            contactDisplayName: getDisplayName({ name: notifTx.agentUser.name }),
            status: notifTx.agentUser.email ? "queued" : "skipped_no_email",
          });
        } else {
          notifications.push({ role: "agent", contactId: null, contactDisplayName: "Agent", status: "skipped_no_contact" });
        }
      }
      if (emailCopy.progressor) {
        if (notifTx.assignedUser) {
          notifications.push({
            role: "progressor",
            contactId: null,
            contactDisplayName: getDisplayName({ name: notifTx.assignedUser.name }),
            status: notifTx.assignedUser.email ? "queued" : "skipped_no_email",
          });
        }
      }
    }
  }

  const isExchangeCode = def?.code === "VM19" || def?.code === "PM26";
  return {
    triggeredCelebration: isExchangeCode,
    propertyAddress: isExchangeCode ? tx.propertyAddress : undefined,
    notifications,
  };
}

export async function markNotRequiredAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  reason: string;
  purchaseType?: PurchaseType;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const result = await markNotRequiredWithCascade({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    reason: input.reason,
    purchaseType: input.purchaseType,
  });

  revalidateTx(input.transactionId);

  return result;
}

export async function reverseMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  reason?: string;
  downstreamIds?: string[];
  newPurchaseType?: PurchaseType;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await reverseMilestoneWithCascade({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
    reason: input.reason,
    downstreamIds: input.downstreamIds,
    newPurchaseType: input.newPurchaseType,
  });

  revalidateTx(input.transactionId);
}

// ─── Undo milestone (two-step: impact read + atomic write) ───────────────────

export async function getUndoImpactAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
  return getUndoImpact(input.transactionId, input.milestoneDefinitionId);
}

export async function executeUndoMilestoneAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  mode: "target_only" | "cascade";
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  await executeUndoMilestone({
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    mode: input.mode,
    completedById: session.user.id,
    completedByName: session.user.name ?? "",
  });

  revalidateTx(input.transactionId);
}

// ─── Exchange / Completion reconciliation ────────────────────────────────────

const BILATERAL_PAIRS: Record<string, string> = {
  VM19: "PM26", PM26: "VM19",
  VM20: "PM27", PM27: "VM20",
};

export async function getExchangeReconciliationList(input: {
  transactionId: string;
  milestoneDefinitionId: string;
}): Promise<{
  outstanding: { id: string; name: string; side: string; code: string; eventDateRequired: boolean }[];
  counterDefId: string | null;
  skipModal: boolean;
}> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });
  if (!def) throw new Error("Milestone definition not found");

  const counterCode = BILATERAL_PAIRS[def.code];
  let counterDefId: string | null = null;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    counterDefId = counterDef?.id ?? null;
  }

  const excludeIds = [input.milestoneDefinitionId, counterDefId].filter(Boolean) as string[];

  const allDefs = await prisma.milestoneDefinition.findMany({
    where: { id: { notIn: excludeIds } },
    select: { id: true, name: true, side: true, code: true, eventDateRequired: true, orderIndex: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: input.transactionId,
      state: { in: ["complete", "not_required"] },
    },
    select: { milestoneDefinitionId: true },
  });
  const doneIds = new Set(completions.map((c) => c.milestoneDefinitionId));

  const outstanding = allDefs
    .filter((d) => !doneIds.has(d.id))
    .map(({ id, name, side, code, eventDateRequired }) => ({ id, name, side, code, eventDateRequired }));

  return { outstanding, counterDefId, skipModal: outstanding.length === 0 };
}

export async function confirmExchangeReconciliationAction(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  eventDate?: string | null;
  outstandingIds: string[];
  outstandingDates: Record<string, string>;
  completionDate?: string;
}) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true, propertyAddress: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });
  if (!def) throw new Error("Milestone definition not found");

  const counterCode = BILATERAL_PAIRS[def.code];
  let counterDefId: string | undefined;
  if (counterCode) {
    const counterDef = await prisma.milestoneDefinition.findFirst({
      where: { code: counterCode },
      select: { id: true },
    });
    counterDefId = counterDef?.id;
  }

  const outstandingDefs = input.outstandingIds.length > 0
    ? await prisma.milestoneDefinition.findMany({
        where: { id: { in: input.outstandingIds } },
        select: { id: true, code: true },
      })
    : [];

  const now = new Date();

  await prisma.$transaction(async (ptx) => {
    // 1. Sweep outstanding milestones FIRST so prerequisite chains are satisfied
    //    before completeMilestone runs its prereq guard for the counterpart
    //    (e.g. PM25 must be complete before completeMilestone(PM26) checks it).
    if (input.outstandingIds.length > 0) {
      await Promise.all(
        input.outstandingIds.map((defId, i) => {
          const dateStr = input.outstandingDates[defId];
          return ptx.milestoneCompletion.upsert({
            where: {
              transactionId_milestoneDefinitionId: {
                transactionId: input.transactionId,
                milestoneDefinitionId: defId,
              },
            },
            create: {
              transactionId: input.transactionId,
              milestoneDefinitionId: defId,
              state: "complete",
              completedAt: new Date(now.getTime() + i),
              eventDate: dateStr ? new Date(dateStr) : null,
              completedById: session.user.id,
              reconciledAtExchange: true,
            },
            update: {
              state: "complete",
              completedAt: new Date(now.getTime() + i),
              eventDate: dateStr ? new Date(dateStr) : null,
              completedById: session.user.id,
              notRequiredReason: null,
              reconciledAtExchange: true,
            },
          });
        })
      );

      // Cancel pending chase tasks + complete reminder logs for swept milestones
      const sweptCodes = outstandingDefs.map((d) => d.code);
      const logs = await ptx.reminderLog.findMany({
        where: {
          transactionId: input.transactionId,
          status: "active",
          reminderRule: { targetMilestoneCode: { in: sweptCodes } },
        },
        select: { id: true },
      });

      if (logs.length > 0) {
        const logIds = logs.map((l) => l.id);
        await ptx.chaseTask.updateMany({
          where: { reminderLogId: { in: logIds }, status: "pending" },
          data: { status: "cancelled" },
        });
        await ptx.reminderLog.updateMany({
          where: { id: { in: logIds } },
          data: { status: "completed", statusReason: "Exchange confirmed" },
        });
      }
    }

    // 2. Primary milestone
    await completeMilestone({
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      completedById: session.user.id,
      completedByName: session.user.name ?? "",
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
    }, ptx);

    // 3. Bilateral counterpart — prereqs now satisfied by the sweep above
    if (counterDefId) {
      const alreadyDone = await ptx.milestoneCompletion.findFirst({
        where: { transactionId: input.transactionId, milestoneDefinitionId: counterDefId, state: "complete" },
      });
      if (!alreadyDone) {
        await completeMilestone({
          transactionId: input.transactionId,
          milestoneDefinitionId: counterDefId,
          completedById: session.user.id,
          completedByName: session.user.name ?? "",
          eventDate: input.eventDate ? new Date(input.eventDate) : null,
        }, ptx);
      }
    }

    // 4. Exchange Forecast sync
    if ((def.code === "VM19" || def.code === "PM26") && input.eventDate) {
      await ptx.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { expectedExchangeDate: new Date(input.eventDate) },
      });
    }
  });

  revalidateTx(input.transactionId);
  revalidatePath("/portal", "layout");

  // Completion date sync for VM20/PM27 (confirmed at completion)
  if ((def.code === "VM20" || def.code === "PM27") && input.eventDate) {
    const actualDate = new Date(input.eventDate);
    const txData = await prisma.propertyTransaction.findFirst({
      where: { id: input.transactionId },
      select: { completionDate: true },
    });
    const existingDate = txData?.completionDate;
    const dateMismatch = !existingDate ||
      Math.abs(actualDate.getTime() - existingDate.getTime()) > 12 * 3600 * 1000;
    if (dateMismatch) {
      await prisma.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { completionDate: actualDate },
      });
      revalidateTx(input.transactionId);
    }
  }

  // Expected completion date captured at exchange time (VM19/PM26)
  if ((def.code === "VM19" || def.code === "PM26") && input.completionDate) {
    await prisma.propertyTransaction.update({
      where: { id: input.transactionId },
      data: { completionDate: new Date(input.completionDate) },
    });
    revalidateTx(input.transactionId);
  }

  // Push notifications (fire-and-forget)
  const code  = def.code;
  const label = getMilestoneCopy(code).label;
  const short = tx.propertyAddress.split(",")[0];

  let title = "Progress update";
  let body  = `${short} — "${label}" is complete.`;

  if (code === "VM19" || code === "PM26") {
    title = "Contracts exchanged!";
    body  = `${short} — your transaction is now legally committed.`;
  } else if (code === "VM20" || code === "PM27") {
    title = "Completed!";
    body  = `${short} — congratulations, your transaction has completed.`;
  }

  pushToTransaction(input.transactionId, { title, body, urlPath: "/progress" }).catch(() => {});
  sendAdminMilestoneNotificationToPortal(
    input.transactionId,
    code,
    input.eventDate ?? null
  ).catch(() => {});

  const isExchangeCode = def.code === "VM19" || def.code === "PM26";
  return {
    triggeredCelebration: isExchangeCode,
    propertyAddress: isExchangeCode ? tx.propertyAddress : undefined,
  };
}
