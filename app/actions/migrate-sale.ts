"use server";

// Boardwalk self-service "Migrate Sale" import.
//
// Brings an EXISTING in-progress sale onto the platform: create the file in the
// agency's OWN account, backdate its historical milestones with their real
// dates, and do it SILENTLY — no client emails, no chases, no invites, no
// retrospective activity. Future progression then behaves exactly like any
// other file at the same stage once the team activates client communications.
//
// Gated to the MIGRATE_SALE_AGENCY_IDS allowlist (lib/agency-features/
// migrate-sale.ts). Ships dark. The nav + page gate the same way; THIS is the
// authoritative server-side enforcement (Law 7). It never trusts a client
// agency id — the file is always created in the caller's own session agency.
//
// Silent-import mechanism (two independent layers):
//   1. clientEmailsPaused: true at import — the lever both the weekly-update
//      and client-chase crons read. No automated client email goes out until
//      the team clears it from the file's Email settings (deliberate
//      activation). Portal invites are manual-only, so no client is invited by
//      the import either, and chain invites are NOT auto-sent here.
//   2. migratedAt (import instant) — the floor the chase crons anchor migrated
//      files to, so once activated no RETROSPECTIVE burst fires for historical
//      steps; only genuinely-outstanding steps chase forward.
// Historical ticks go through applyMigratedMilestoneCompletions, which writes
// MilestoneCompletion rows directly (bypassing the completeMilestone fan-out),
// so completion emails / push / completion packs / chain notifications never
// run for a backdated step.
//
// Reliability: idempotent (client-minted key resolves a retry / double-submit
// to the SAME file) and recoverable (migrationFinalizedAt is stamped only after
// the whole import succeeds; a keyed-but-unfinalized file is resumed on retry,
// never duplicated). Never reports success unless file + contacts + every
// requested historical milestone landed.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { canMigrateSale } from "@/lib/agency-features/migrate-sale";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { createTransaction } from "@/lib/services/transactions";
import { initializeMilestoneCompletions } from "@/lib/services/milestones";
import { applyMigratedMilestoneCompletions } from "@/lib/services/migrate-milestones";
import { createChainV2 } from "@/lib/services/chains";
import { normaliseAddressString } from "@/lib/utils/address";
import { findFirstPairwiseConflict } from "@/lib/contacts/dedupe";
import { computeAutoNrCodes } from "@/lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import type { PurchaseType, Tenure, ContactRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

type ContactInput = { name: string; companyName?: string; phone?: string; email?: string; roleType: ContactRole };
type MigrateStubInput = {
  // Chain stub direction relative to this file ("above" = onward/upward seller
  // side, "below" = buyer side), matching createChainV2's stub shape.
  direction: "above" | "below";
  stubPropertyAddress: string;
  stubAgencyName: string;
  stubAgentName?: string | null;
  stubAgentEmail?: string | null;
  stubAgentPhone?: string | null;
  stubNotes?: string | null;
};

export type MigrateSaleInput = {
  // Client-minted UUID, one per review session. Makes the import idempotent.
  idempotencyKey: string;
  propertyAddress: string;
  purchasePrice: number | null;
  tenure: Tenure;
  isShareOfFreehold?: boolean;
  purchaseType: PurchaseType;
  notes?: string | null;
  // The sale's real start date in the old system (ISO yyyy-mm-dd). Backdates
  // createdAt for a realistic age + 12-week target.
  originalCreatedAt: string;
  // Self-managed (agency progresses it) vs outsourced. Agencies migrating their
  // own book are normally self-managed.
  progressedBy?: "agent" | "progressor";
  // Optional: assign the file to a specific agency agent (director/negotiator)
  // as the owning CM. Blank falls back to the importer (never ownerless).
  assignToUserId?: string | null;
  // Optional: assign an in-house progressor (assignedUserId). Only honoured when
  // the agency runs in-house progression. null = decide later; a progressor
  // importing is pre-selected client-side so the file lands with them.
  inHouseProgressorId?: string | null;
  contacts: ContactInput[];
  vendorSolicitorFirmId?: string | null;
  vendorSolicitorContactId?: string | null;
  purchaserSolicitorFirmId?: string | null;
  purchaserSolicitorContactId?: string | null;
  brokerFirmId?: string | null;
  brokerContactId?: string | null;
  agentFeeAmount?: number | null;
  agentFeePercent?: number | null;
  agentFeeIsVatInclusive?: boolean | null;
  referralFee?: number | null;
  // Attached Memo of Sale document (uploaded via /api/agent/memo-parse).
  mosStoragePath?: string | null;
  mosFileSize?: number | null;
  mosMimeType?: string | null;
  mosFilename?: string | null;
  // Chain neighbours (structure only — invites are NOT auto-sent on import).
  chainStubs?: MigrateStubInput[];
  // Historical milestones already completed, with their real dates.
  completions: Array<{ milestoneDefinitionId: string; eventDate: string }>;
  // Allow creating a second file at an address that already has one.
  forceCreate?: boolean;
};

export type MigrateSaleResult =
  | { ok: true; id: string; applied: number; deduped?: boolean }
  | { ok: false; kind: "forbidden" | "validation" | "duplicate_address" | "duplicate_contact" | "partial"; message: string; id?: string };

const MIN_DATE = new Date("2000-01-01T00:00:00Z").getTime();

export async function migrateBoardwalkSaleAction(input: MigrateSaleInput): Promise<MigrateSaleResult> {
  const session = await requireSession();

  // Server-side agency gate (Law 7) — defence-in-depth behind the nav + page.
  if (!canMigrateSale(session)) {
    return { ok: false, kind: "forbidden", message: "This feature is not available for your account." };
  }
  const agencyId = session.user.agencyId;

  // ─── Validation ──────────────────────────────────────────────────────────
  if (!input.idempotencyKey?.trim()) {
    return { ok: false, kind: "validation", message: "Missing import key. Refresh and try again." };
  }
  const address = (input.propertyAddress ?? "").trim();
  if (address.length < 3) return { ok: false, kind: "validation", message: "A property address is required." };
  if (!input.tenure) return { ok: false, kind: "validation", message: "Tenure is required." };
  if (!input.purchaseType) return { ok: false, kind: "validation", message: "Purchase type is required." };

  const vendors = input.contacts.filter((c) => c.roleType === "vendor" && c.name?.trim());
  const purchasers = input.contacts.filter((c) => c.roleType === "purchaser" && c.name?.trim());
  if (vendors.length === 0) return { ok: false, kind: "validation", message: "At least one seller is required." };
  if (purchasers.length === 0) return { ok: false, kind: "validation", message: "At least one buyer is required." };

  const now = new Date();
  const createdAtDate = new Date(input.originalCreatedAt);
  if (Number.isNaN(createdAtDate.getTime())) return { ok: false, kind: "validation", message: "Invalid sale start date." };
  if (createdAtDate.getTime() > now.getTime()) return { ok: false, kind: "validation", message: "The sale start date can't be in the future." };
  if (createdAtDate.getTime() < MIN_DATE) return { ok: false, kind: "validation", message: "The sale start date looks wrong." };

  // Pairwise contact dedupe (reuses the exact new-sale guard).
  const conflict = findFirstPairwiseConflict(input.contacts);
  if (conflict) {
    return {
      ok: false,
      kind: "duplicate_contact",
      message: `Two contacts share the same ${conflict.kind === "phone" ? "phone number" : "email"} (${conflict.withName}). Fix one and try again.`,
    };
  }

  // Historical-date + prerequisite validation on the ticked milestones.
  const tickedDefIds = input.completions.map((c) => c.milestoneDefinitionId);
  let defsByTicked: Map<string, { id: string; code: string }> = new Map();
  if (tickedDefIds.length > 0) {
    const defs = await prisma.milestoneDefinition.findMany({
      where: { id: { in: tickedDefIds } },
      select: { id: true, code: true },
    });
    defsByTicked = new Map(defs.map((d) => [d.id, d]));
    const tickedCodes = new Set<string>();
    for (const c of input.completions) {
      const def = defsByTicked.get(c.milestoneDefinitionId);
      if (!def) return { ok: false, kind: "validation", message: "Unknown milestone in the historical list." };
      tickedCodes.add(def.code);
      const d = new Date(c.eventDate);
      if (Number.isNaN(d.getTime())) return { ok: false, kind: "validation", message: `Enter a date for ${def.code}.` };
      if (d.getTime() > now.getTime()) return { ok: false, kind: "validation", message: `${def.code}'s date can't be in the future.` };
      if (d.getTime() < MIN_DATE) return { ok: false, kind: "validation", message: `${def.code}'s date looks wrong.` };
    }

    // Respect milestone rules: a ticked step whose direct prerequisite is
    // neither ticked nor auto-NR for this tenure/method is rejected (we never
    // silently complete extra steps — §5). The UI mirrors this.
    const autoNr = computeAutoNrCodes(input.purchaseType, input.tenure);
    for (const code of tickedCodes) {
      const prereqs = DIRECT_PREREQUISITES[code] ?? [];
      const missing = prereqs.filter((p) => !tickedCodes.has(p) && !autoNr.has(p));
      if (missing.length > 0) {
        return {
          ok: false,
          kind: "validation",
          message: `Before marking ${code} complete, also mark its earlier step${missing.length > 1 ? "s" : ""} ${missing.join(", ")}.`,
        };
      }
    }
  }

  // ─── Idempotency: find an existing import for this key ────────────────────
  const existing = await prisma.propertyTransaction.findUnique({
    where: { migrationIdempotencyKey: input.idempotencyKey },
    select: { id: true, agencyId: true, migrationFinalizedAt: true, activeBuyerRoundId: true },
  });
  if (existing) {
    // Never let one agency's key touch another agency's file.
    if (existing.agencyId !== agencyId) {
      return { ok: false, kind: "forbidden", message: "This import belongs to another account." };
    }
    if (existing.migrationFinalizedAt) {
      // Already fully imported — treat the retry as success, no duplicate.
      return { ok: true, id: existing.id, applied: input.completions.length, deduped: true };
    }
    // Keyed but unfinalized — resume the remaining idempotent steps.
    return finalizeImport(existing.id, existing.activeBuyerRoundId, input, agencyId, session.user.id);
  }

  // ─── Duplicate-address guard (unless forced) ──────────────────────────────
  if (!input.forceCreate) {
    const normAddress = address.toLowerCase().replace(/\s+/g, " ").trim();
    const samePlace = await prisma.propertyTransaction.findMany({
      where: { agencyId, status: { in: ["active", "on_hold", "withdrawn"] } },
      select: { id: true, propertyAddress: true },
    });
    const dup = samePlace.find((t) => t.propertyAddress.toLowerCase().replace(/\s+/g, " ").trim() === normAddress);
    if (dup) {
      return { ok: false, kind: "duplicate_address", message: "A file already exists for this address. Confirm you want to import another.", id: dup.id };
    }
  }

  // ─── Resolve the owning CM + in-house progressor ──────────────────────────
  // Mirrors the New Sale action (transactions.ts). The CM is validated to this
  // agency and ALWAYS ends up set (falls back to the importer) so a file is
  // never ownerless. The progressor is validated to the agency's in-house pool;
  // a progressor importing with no explicit pick takes it on themselves (the
  // form pre-selects them, so that default is applied client-side — an explicit
  // "decide later" arrives as null and is respected).
  let resolvedAgentUserId = session.user.id;
  if (input.assignToUserId) {
    const target = await prisma.user.findUnique({ where: { id: input.assignToUserId }, select: { id: true, agencyId: true, role: true } });
    if (!target || target.agencyId !== agencyId) return { ok: false, kind: "validation", message: "Cannot assign to a user outside your agency." };
    if (target.role !== "director" && target.role !== "negotiator") return { ok: false, kind: "validation", message: "Cannot assign to a non-agent user." };
    resolvedAgentUserId = target.id;
  }

  let resolvedAssignedUserId: string | undefined = undefined;
  const importAgency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { inHouseProgressionEnabled: true } });
  if (importAgency?.inHouseProgressionEnabled) {
    if (input.inHouseProgressorId) {
      const prog = await prisma.user.findUnique({ where: { id: input.inHouseProgressorId }, select: { id: true, agencyId: true, isInHouseProgressor: true } });
      if (!prog || prog.agencyId !== agencyId || !prog.isInHouseProgressor) return { ok: false, kind: "validation", message: "Cannot assign: that user is not an in-house progressor in your agency." };
      resolvedAssignedUserId = prog.id;
    } else if (input.inHouseProgressorId === undefined) {
      const creator = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isInHouseProgressor: true, agencyId: true } });
      if (creator?.isInHouseProgressor && creator.agencyId === agencyId) resolvedAssignedUserId = session.user.id;
    }
  }

  // ─── Create the file ──────────────────────────────────────────────────────
  // Always the caller's own agency — never a client-supplied id (tenant safety).
  let txId: string;
  let activeBuyerRoundId: string | null;
  try {
    const tx = await createTransaction({
      propertyAddress: normaliseAddressString(address),
      agencyId,
      // Owning CM, resolved + validated above. Never null, so the file never
      // drops out of agent-scoped surfaces (Reminders, hub lanes, "managing this").
      agentUserId: resolvedAgentUserId,
      // In-house progressor, resolved + validated above (undefined = none yet).
      assignedUserId: resolvedAssignedUserId,
      progressedBy: input.progressedBy ?? "agent",
      createdAt: createdAtDate, // backdated start
      isMigrated: true,
      migratedAt: now, // import instant — the forward-automation floor
      clientEmailsPaused: true, // hold client comms until the team activates
      migrationIdempotencyKey: input.idempotencyKey,
      purchasePrice: input.purchasePrice,
      tenure: input.tenure,
      isShareOfFreehold: input.tenure === "leasehold" ? (input.isShareOfFreehold ?? false) : false,
      purchaseType: input.purchaseType,
      notes: input.notes ?? null,
      vendorSolicitorFirmId: input.vendorSolicitorFirmId ?? null,
      vendorSolicitorContactId: input.vendorSolicitorContactId ?? null,
      purchaserSolicitorFirmId: input.purchaserSolicitorFirmId ?? null,
      purchaserSolicitorContactId: input.purchaserSolicitorContactId ?? null,
      brokerFirmId: input.brokerFirmId ?? null,
      brokerContactId: input.brokerContactId ?? null,
      agentFeeAmount: input.agentFeeAmount ?? null,
      agentFeePercent: input.agentFeePercent ?? null,
      agentFeeIsVatInclusive: input.agentFeeIsVatInclusive ?? null,
      referralFee: input.referralFee ?? null,
    });
    txId = tx.id;
    activeBuyerRoundId = tx.activeBuyerRoundId;
  } catch (err) {
    // Unique-constraint violation on the idempotency key => a concurrent
    // double-submit won the race. Resolve to that file instead of erroring.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await prisma.propertyTransaction.findUnique({
        where: { migrationIdempotencyKey: input.idempotencyKey },
        select: { id: true, agencyId: true, migrationFinalizedAt: true, activeBuyerRoundId: true },
      });
      if (raced && raced.agencyId === agencyId) {
        if (raced.migrationFinalizedAt) return { ok: true, id: raced.id, applied: input.completions.length, deduped: true };
        return finalizeImport(raced.id, raced.activeBuyerRoundId, input, agencyId, session.user.id);
      }
    }
    console.error("[migrateBoardwalkSaleAction] createTransaction failed:", err);
    return { ok: false, kind: "partial", message: "Couldn't create the file. Nothing was saved. Try again." };
  }

  return finalizeImport(txId, activeBuyerRoundId, input, agencyId, session.user.id);
}

// Runs every step AFTER the file row exists. Each step is idempotent so a retry
// (resume) is safe. Stamps migrationFinalizedAt only on full success; any
// failure returns a "partial" result WITHOUT finalizing (so success is never
// falsely reported) and the file is resumable via the idempotency key.
async function finalizeImport(
  transactionId: string,
  activeBuyerRoundId: string | null,
  input: MigrateSaleInput,
  agencyId: string,
  actingUserId: string,
): Promise<MigrateSaleResult> {
  try {
    // Contacts — only if none exist yet (resume-safe, no duplicates).
    const existingContacts = await prisma.contact.count({ where: { propertyTransactionId: transactionId } });
    if (existingContacts === 0 && input.contacts.length > 0) {
      await prisma.contact.createMany({
        data: input.contacts
          .filter((c) => c.name?.trim())
          .map((c) => ({
            propertyTransactionId: transactionId,
            name: c.name.trim(),
            companyName: c.companyName?.trim() || null,
            isBusiness: !!c.companyName?.trim(),
            phone: c.phone?.trim() || null,
            email: c.email?.trim() || null,
            roleType: c.roleType,
            portalToken: randomUUID(),
            buyerRoundId: c.roleType === "purchaser" ? activeBuyerRoundId : null,
          })),
      });
    }

    // Milestone set — idempotent (find-then-create-if-missing).
    await initializeMilestoneCompletions(transactionId, input.tenure, input.purchaseType, actingUserId, activeBuyerRoundId);

    // Historical ticks — SILENT backdated writes via the shared core.
    // completerId null => "Auto-confirmed" (not a misleading "X confirmed on
    // <historical date>"). Enforce all-or-nothing: a short count fails the import.
    if (input.completions.length > 0) {
      const { applied } = await applyMigratedMilestoneCompletions({
        transactionId,
        completions: input.completions,
        completerId: null,
      });
      if (applied !== input.completions.length) {
        return { ok: false, kind: "partial", message: "Some historical milestones didn't import. Nothing was sent. Retry to finish.", id: transactionId };
      }
    }

    // Chain structure — linked but invites NOT auto-sent (silent). Resume-safe.
    if (input.chainStubs && input.chainStubs.length > 0) {
      const alreadyLinked = await prisma.propertyTransaction.findUnique({
        where: { id: transactionId },
        select: { chainLinkId: true },
      });
      if (!alreadyLinked?.chainLinkId) {
        await createChainV2({
          transactionId,
          agencyId,
          userId: actingUserId,
          stubs: input.chainStubs.map((s) => ({
            direction: s.direction,
            stubPropertyAddress: normaliseAddressString(s.stubPropertyAddress),
            stubAgencyName: s.stubAgencyName,
            stubAgentEmail: s.stubAgentEmail || null,
            stubAgentName: s.stubAgentName || null,
            stubAgentPhone: s.stubAgentPhone || null,
            stubNotes: s.stubNotes || null,
          })),
        });
      }
    }

    // Attach the Memo of Sale document (resume-safe: skip if already attached).
    if (input.mosStoragePath && input.mosFileSize && input.mosMimeType) {
      const hasMos = await prisma.transactionDocument.count({ where: { transactionId, source: "mos" } });
      if (hasMos === 0) {
        await prisma.transactionDocument.create({
          data: {
            transactionId,
            filename: input.mosFilename ?? "Memorandum of Sale",
            storagePath: input.mosStoragePath,
            fileSize: input.mosFileSize,
            mimeType: input.mosMimeType,
            source: "mos",
            uploadedById: actingUserId,
          },
        });
      }
    }

    // Finalize — the LAST write. Only now is the import reported as succeeded.
    await prisma.propertyTransaction.update({
      where: { id: transactionId },
      data: { migrationFinalizedAt: new Date() },
    });

    revalidatePath("/agent/hub"); // dismiss the zero-sale first-run hub (matches the normal add-sale path)
    revalidatePath("/agent/transactions");
    revalidatePath(`/agent/transactions/${transactionId}`, "layout");
    return { ok: true, id: transactionId, applied: input.completions.length };
  } catch (err) {
    console.error("[migrateBoardwalkSaleAction] finalize failed:", err);
    return { ok: false, kind: "partial", message: "The import didn't finish. No client messages were sent. Retry to complete it.", id: transactionId };
  }
}
