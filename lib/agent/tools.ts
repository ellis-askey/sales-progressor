// The progression agent's READ-ONLY tool layer.
//
// Hard guarantees:
//   - Every tool operates ONLY on the transaction bound to this context. The
//     model cannot supply a transaction id: the schemas expose none, and the
//     dispatchers ignore any input beyond their declared params, always using
//     ctx.transactionId. So the model can never inspect another file.
//   - The context is built from the transaction's OWN agencyId, and the
//     top-level read re-applies scopeOwnershipWhere, so a bug that mislabels a
//     transaction still cannot cross an agency boundary.
//   - Tools return curated, minimal shapes — never raw Prisma rows.
//
// No write path exists here. There is deliberately no tool that mutates.

import { prisma } from "@/lib/prisma";
import { scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";
import { SOLICITOR_STEP_LABELS, VENDOR_SOLICITOR_CODES, PURCHASER_SOLICITOR_CODES } from "@/lib/solicitor-confirm/codes";
import type { AgentToolSchema } from "@/lib/agent/provider";
import type { ToolDispatch } from "@/lib/agent/loop";

export const CONFIRMABLE_CODES: ReadonlySet<string> = new Set([
  ...VENDOR_SOLICITOR_CODES,
  ...PURCHASER_SOLICITOR_CODES,
]);

export type ToolContext = {
  transactionId: string;
  agencyId: string;
  activeBuyerRoundId: string | null;
  scope: AccessScope;
};

// Build a per-run context. Returns null if the transaction no longer exists.
// The scope is derived from the transaction's own agency — never "all".
export async function buildAgentToolContext(transactionId: string): Promise<ToolContext | null> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { id: true, agencyId: true, activeBuyerRoundId: true },
  });
  if (!tx) return null;
  return {
    transactionId: tx.id,
    agencyId: tx.agencyId,
    activeBuyerRoundId: tx.activeBuyerRoundId,
    scope: { kind: "agency", agencyIds: [tx.agencyId] },
  };
}

export type MilestoneFacts = {
  open: { code: string; label: string }[]; // confirmable, not yet done
  done: { code: string; label: string }[]; // complete or not-required
  confirmableSet: ReadonlySet<string>;
  doneSet: ReadonlySet<string>;
};

function label(code: string, fallback: string): string {
  return SOLICITOR_STEP_LABELS[code] ?? fallback ?? code;
}

// Active-round-scoped milestone state: file-level (vendor) rows + the active
// buyer round's (purchaser) rows. Union of "done" codes is used, so a step done
// on any relevant round is never re-proposed.
export async function loadMilestoneFacts(ctx: ToolContext): Promise<MilestoneFacts> {
  const roundFilter = ctx.activeBuyerRoundId
    ? { OR: [{ buyerRoundId: null }, { buyerRoundId: ctx.activeBuyerRoundId }] }
    : {};
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: ctx.transactionId, ...roundFilter },
    select: { state: true, milestoneDefinition: { select: { code: true, name: true } } },
  });

  const doneSet = new Set<string>();
  const done: { code: string; label: string }[] = [];
  for (const c of completions) {
    if (c.state === "complete" || c.state === "not_required") {
      const code = c.milestoneDefinition.code;
      if (!doneSet.has(code)) {
        doneSet.add(code);
        done.push({ code, label: label(code, c.milestoneDefinition.name) });
      }
    }
  }
  const open = [...CONFIRMABLE_CODES]
    .filter((c) => !doneSet.has(c))
    .map((c) => ({ code: c, label: label(c, c) }));

  return { open, done, confirmableSet: CONFIRMABLE_CODES, doneSet };
}

// ── Read tools ──────────────────────────────────────────────────────────────

const EMPTY_OBJ = { type: "object" as const, properties: {} };

export function readToolSchemas(): AgentToolSchema[] {
  return [
    { name: "getTransactionContext", description: "Basic facts about this sale: address, tenure, purchase type, status, service type.", input_schema: EMPTY_OBJ },
    { name: "getMilestones", description: "The confirmable milestone steps that are still open on this file, and the steps already done.", input_schema: EMPTY_OBJ },
    { name: "getEnquiryState", description: "The conveyancing-enquiries state: whose court it is in and any outstanding note.", input_schema: EMPTY_OBJ },
    {
      name: "getRecentCommunications",
      description: "The most recent communications on this file (excluding WhatsApp), newest first.",
      input_schema: { type: "object", properties: { limit: { type: "number", description: "How many (1-8, default 5)." } } },
    },
    { name: "getOutstandingTasks", description: "Open chase tasks and manual tasks on this file.", input_schema: EMPTY_OBJ },
    { name: "getRelevantContacts", description: "The people on this file: names and roles (seller, buyer, solicitor, etc.).", input_schema: EMPTY_OBJ },
  ];
}

export function buildReadTools(ctx: ToolContext, facts: MilestoneFacts): { schemas: AgentToolSchema[]; dispatch: ToolDispatch } {
  const txId = ctx.transactionId;

  const handlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
    async getTransactionContext() {
      const tx = await prisma.propertyTransaction.findFirst({
        where: scopeOwnershipWhere(ctx.scope, txId),
        select: { propertyAddress: true, tenure: true, purchaseType: true, status: true, serviceType: true },
      });
      if (!tx) return { error: "transaction not accessible" };
      return {
        address: tx.propertyAddress,
        tenure: tx.tenure,
        purchaseType: tx.purchaseType,
        status: tx.status,
        serviceType: tx.serviceType,
      };
    },

    async getMilestones() {
      return { open: facts.open, done: facts.done };
    },

    async getEnquiryState() {
      const t = await prisma.enquiryTracker.findUnique({
        where: { transactionId: txId },
        select: { currentlyWith: true, outstandingNote: true, closedAt: true },
      });
      if (!t) return { present: false };
      return { present: true, currentlyWith: t.currentlyWith, outstandingNote: t.outstandingNote, closed: !!t.closedAt };
    },

    async getRecentCommunications(input) {
      const raw = typeof input.limit === "number" ? input.limit : 5;
      const limit = Math.max(1, Math.min(8, Math.floor(raw)));
      const rows = await prisma.outboundMessage.findMany({
        where: { transactionId: txId, method: { not: "whatsapp" } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          createdAt: true, type: true, subject: true, content: true,
          recipientName: true, recipientEmail: true, senderLabel: true, providerWebhookData: true,
        },
      });
      return rows.map((r) => {
        const from = (r.providerWebhookData as { from?: string } | null)?.from ?? r.senderLabel ?? (r.type === "inbound" ? r.recipientEmail : null);
        return {
          when: r.createdAt.toISOString().slice(0, 10),
          direction: r.type,
          from: from ?? null,
          subject: r.subject,
          snippet: (r.content ?? "").slice(0, 240),
        };
      });
    },

    async getOutstandingTasks() {
      const [chase, manual] = await Promise.all([
        prisma.chaseTask.findMany({
          where: { transactionId: txId, status: "pending" },
          take: 10,
          select: { dueDate: true, notes: true, reminderLog: { select: { reminderRule: { select: { name: true } } } } },
        }),
        prisma.manualTask.findMany({
          where: { transactionId: txId, status: "open" },
          take: 10,
          select: { title: true, dueDate: true },
        }),
      ]);
      return {
        chases: chase.map((c) => ({ rule: c.reminderLog?.reminderRule?.name ?? null, due: c.dueDate?.toISOString().slice(0, 10) ?? null, note: c.notes ?? null })),
        tasks: manual.map((t) => ({ title: t.title, due: t.dueDate?.toISOString().slice(0, 10) ?? null })),
      };
    },

    async getRelevantContacts() {
      const contacts = await prisma.contact.findMany({
        where: { propertyTransactionId: txId },
        take: 20,
        select: { name: true, roleType: true },
      });
      return contacts.map((c) => ({ name: c.name, role: c.roleType }));
    },
  };

  const dispatch: ToolDispatch = async (name, input) => {
    const handler = handlers[name];
    if (!handler) return JSON.stringify({ error: `unknown tool: ${name}` });
    const result = await handler(input ?? {});
    return JSON.stringify(result);
  };

  return { schemas: readToolSchemas(), dispatch };
}
