// lib/services/chase-echo.ts
// Posts the passive, signed portal updates that mirror a manual chase or an
// enquiry movement onto the buyer/seller portal. Reviewed with Ellis 2026-09-14.
//
// Behaviour (see the phrasing matrix):
//   - Passive: writes an in_app OutboundMessage (no client email; we fire a push
//     for installed clients only). NOT routed through createCommunicationRecord,
//     whose visibleToClient path emails clients.
//   - Signed: attributed to the person who chased/logged it (createdById) so the
//     portal shows their photo, not the anonymous "Your team".
//   - Side-aware: one row per target side, addressed to that side's contacts, so
//     each side reads its own wording and never sees the other's.
//   - Solicitor chase -> both sides; client chase -> other side only.
//
// Every function is best-effort: callers wrap in .catch so a portal echo never
// breaks the chase itself.

import { prisma } from "@/lib/prisma";
import { pushToContact } from "@/lib/services/push";
import { VENDOR_SOLICITOR_CODES, PURCHASER_SOLICITOR_CODES } from "@/lib/solicitor-confirm/codes";
import {
  solicitorChaseLine,
  clientChaseLine,
  enquiryEchoLine,
  hasSolicitorEchoCopy,
  hasClientEchoCopy,
  type EchoSide,
  type EnquiryEchoKind,
} from "@/lib/portal/chase-echo-copy";

const otherSide = (s: EchoSide): EchoSide => (s === "vendor" ? "purchaser" : "vendor");

// Steps issued to BOTH the client and the solicitor. From a drawer chase we know
// which was chosen (via contactIds); from the ↻ Chased button we can't tell, so
// these are skipped there rather than guessing.
const SHARED_STEP_CODES = new Set(["VM5", "VM16", "PM22"]);

// Infer who a chase went to from the step code alone (used by the ↻ Chased
// button, which doesn't pick a recipient). Returns null when we can't safely
// tell — no side prefix, or a shared step.
export function classifyChaseFromCode(
  code: string,
): { recipientType: "solicitor" | "client"; chasedSide: EchoSide } | null {
  const chasedSide: EchoSide | null = code.startsWith("VM") ? "vendor" : code.startsWith("PM") ? "purchaser" : null;
  if (!chasedSide) return null;
  if (SHARED_STEP_CODES.has(code)) return null;
  const isSolicitor = VENDOR_SOLICITOR_CODES.has(code) || PURCHASER_SOLICITOR_CODES.has(code);
  return { recipientType: isSolicitor ? "solicitor" : "client", chasedSide };
}

// Write one signed, client-visible in_app row addressed to a single side, and
// push it to that side's installed devices. Returns silently when the side has
// no contacts (e.g. a file with no buyer yet).
async function postSignedSideUpdate(opts: {
  transactionId: string;
  agencyId: string | null;
  side: EchoSide;
  activeBuyerRoundId: string | null;
  content: string;
  actorUserId: string;
  addressShort: string;
}): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where:
      opts.side === "vendor"
        ? { propertyTransactionId: opts.transactionId, roleType: "vendor" }
        : { propertyTransactionId: opts.transactionId, roleType: "purchaser", buyerRoundId: opts.activeBuyerRoundId },
    select: { id: true, portalToken: true },
  });
  if (contacts.length === 0) return;

  await prisma.outboundMessage.create({
    data: {
      agencyId: opts.agencyId,
      transactionId: opts.transactionId,
      channel: "in_app",
      purpose: "notification",
      status: "sent",
      type: "outbound",
      // null method + in_app channel = a passive portal update, not an email.
      contactIds: contacts.map((c) => c.id),
      content: opts.content,
      visibleToClient: true,
      isAutomated: false, // a person chased — this drives the signed avatar on the portal
      createdById: opts.actorUserId,
      // Scope purchaser rows to the active buyer round; vendor rows stay file-level.
      buyerRoundId: opts.side === "purchaser" ? opts.activeBuyerRoundId : null,
    },
  });

  const body = opts.content.length > 100 ? opts.content.slice(0, 97) + "…" : opts.content;
  for (const c of contacts) {
    if (!c.portalToken) continue;
    pushToContact(c.id, {
      title: `New update: ${opts.addressShort}`,
      body,
      url: `/portal/${c.portalToken}/updates`,
    }).catch(() => {});
  }
}

async function loadEchoTx(transactionId: string) {
  return prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      agencyId: true,
      activeBuyerRoundId: true,
      propertyAddress: true,
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
    },
  });
}

// Mirror a manual chase to the portal(s). `recipientType` is decided at the call
// site: the drawer knows it from the recipient (solicitor = empty contactIds),
// the ↻ Chased button infers it from the step. `chasedSide` is the side of the
// party we chased (vendor = seller / seller's solicitor).
export async function postChaseEcho(opts: {
  transactionId: string;
  code: string;
  recipientType: "solicitor" | "client";
  chasedSide: EchoSide;
  actorUserId: string;
}): Promise<void> {
  const tx = await loadEchoTx(opts.transactionId);
  if (!tx) return;
  const addressShort = tx.propertyAddress.split(",")[0];
  const base = {
    transactionId: opts.transactionId,
    agencyId: tx.agencyId,
    activeBuyerRoundId: tx.activeBuyerRoundId,
    actorUserId: opts.actorUserId,
    addressShort,
  };

  if (opts.recipientType === "solicitor") {
    if (!hasSolicitorEchoCopy(opts.code)) return;
    const firmName =
      opts.chasedSide === "vendor"
        ? tx.vendorSolicitorFirm?.name ?? null
        : tx.purchaserSolicitorFirm?.name ?? null;
    for (const side of ["vendor", "purchaser"] as EchoSide[]) {
      const content = solicitorChaseLine({ code: opts.code, viewerSide: side, chasedSide: opts.chasedSide, firmName });
      if (content) await postSignedSideUpdate({ ...base, side, content });
    }
    return;
  }

  // Client chased — only the other side hears about it.
  if (!hasClientEchoCopy(opts.code)) return;
  const content = clientChaseLine({ code: opts.code, chasedSide: opts.chasedSide, stepLabel: null });
  await postSignedSideUpdate({ ...base, side: otherSide(opts.chasedSide), content });
}

// Mirror an enquiry movement (replies sent / partial / raised) to both portals.
export async function postEnquiryEcho(opts: {
  transactionId: string;
  kind: EnquiryEchoKind;
  actorUserId: string;
}): Promise<void> {
  const tx = await loadEchoTx(opts.transactionId);
  if (!tx) return;
  const addressShort = tx.propertyAddress.split(",")[0];
  for (const side of ["vendor", "purchaser"] as EchoSide[]) {
    const content = enquiryEchoLine(opts.kind, side);
    if (content) {
      await postSignedSideUpdate({
        transactionId: opts.transactionId,
        agencyId: tx.agencyId,
        activeBuyerRoundId: tx.activeBuyerRoundId,
        side,
        content,
        actorUserId: opts.actorUserId,
        addressShort,
      });
    }
  }
}
