"use server";

// Read-only preview of the email a pending auto-chase WILL send, for the "View"
// button on the Reminders-page autopilot rows. Reuses the exact composers the
// crons use — assembleDigestPayload (client) and buildSolicitorDigestEmail
// (solicitor) — so the body is real, not a mock. It's still labelled a preview
// in the UI: the email is composed fresh at send time (10:30 / 09:00), the warm
// subject variant rotates, and agency copy edits / overrides aren't applied here.

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeReminderLogWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { assembleDigestPayload } from "@/lib/email/client-chase-digest";
import { buildSolicitorDigestEmail } from "@/lib/solicitor-confirm/digest-email";
import { signSolicitorToken } from "@/lib/solicitor-confirm/token";
import { getAvatarPublicUrl } from "@/lib/supabase-storage";
import { joinNames } from "@/lib/services/chase-recipients";
import { resolveClientChaseContent } from "@/lib/agency-email/templates";
import { getChaseOverridesForBuild } from "@/lib/services/chase-overrides";
import { wrapEditedBody } from "@/lib/email/wrap-edited-body";

export type AutoChasePreview = {
  ok: true;
  pipeline: "client" | "solicitor";
  recipientName: string;
  recipientRole: string;
  subject: string;
  html: string;
} | { ok: false; error: string };

function sideForCode(code: string): "vendor" | "purchaser" {
  return code.startsWith("PM") ? "purchaser" : "vendor";
}

// Public entry: never hang, never leak a raw error. The core build is fast
// (pure composers behind a few DB reads), but a cold/slow serverless
// invocation can stall on the nested reminderLog read. Bound it, log the real
// reason server-side for diagnosis, and show the user a clean, retryable line.
function withTimeout<T>(ms: number, p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), timeout]);
}

export async function getAutoChasePreview(
  logId: string,
  pipeline: "client" | "solicitor",
): Promise<AutoChasePreview> {
  try {
    return await withTimeout(8000, buildAutoChasePreview(logId, pipeline));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[auto-chase-preview] failed", { logId, pipeline, message });
    return {
      ok: false,
      error: message === "TIMEOUT"
        ? "The preview took too long to build. Try again."
        : "Couldn't build this preview. Open the file to see the email.",
    };
  }
}

async function buildAutoChasePreview(
  logId: string,
  pipeline: "client" | "solicitor",
): Promise<AutoChasePreview> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const log = await prisma.reminderLog.findFirst({
    where: scopeReminderLogWhere(scope, logId),
    select: {
      reminderRule: { select: { targetMilestoneCode: true, anchorMilestone: { select: { name: true } } } },
      transaction: {
        select: {
          id: true, propertyAddress: true, purchasePrice: true, agencyId: true,
          agency: { select: { name: true } },
          agentUser: { select: { name: true, phone: true, image: true } },
          assignedUser: { select: { name: true, phone: true, image: true } },
          contacts: { select: { id: true, name: true, roleType: true, portalToken: true } },
          vendorSolicitorFirm: { select: { name: true } },
          vendorSolicitorContact: { select: { name: true, email: true } },
          purchaserSolicitorFirm: { select: { name: true } },
          purchaserSolicitorContact: { select: { name: true, email: true } },
        },
      },
    },
  });

  const code = log?.reminderRule.targetMilestoneCode;
  const tx = log?.transaction;
  if (!log || !tx || !code) return { ok: false, error: "This reminder can't be previewed." };

  const side = sideForCode(code);
  const brand = tx.agency?.name ?? "Sales Progressor";
  const milestoneLabel = log.reminderRule.anchorMilestone?.name ?? "the outstanding step";

  if (pipeline === "solicitor") {
    const firmName = side === "vendor" ? tx.vendorSolicitorFirm?.name ?? null : tx.purchaserSolicitorFirm?.name ?? null;
    const solContact = side === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
    const sellerNames = joinNames(tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name));
    const buyerNames = joinNames(tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name));
    const ownClientNames = (side === "vendor" ? sellerNames : buyerNames) || tx.propertyAddress;
    const person = tx.assignedUser ?? tx.agentUser;
    const token = signSolicitorToken(tx.id, side);
    const base = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

    const built = buildSolicitorDigestEmail({
      brand,
      address: tx.propertyAddress,
      pricePence: tx.purchasePrice,
      sellerNames,
      buyerNames,
      side,
      firmName,
      ownClientNames,
      steps: [{ label: milestoneLabel }],
      confirmUrl: `${base}/s/${token}`,
      stopUrl: `${base}/s/${token}/stop`,
      qrUrl: `${base}/s/${token}/qr`,
      personName: person?.name ?? brand,
      personPhone: person?.phone ?? null,
      avatarUrl: getAvatarPublicUrl(person?.image),
    });

    // Apply an agent's per-chase edit from the timeline (that's what will send):
    // an edited subject replaces ours; an edited body sends verbatim in a plain
    // frame instead of the branded shell (mirrors sendDigestForGroup).
    const ov = (await getChaseOverridesForBuild(tx.id)).get(`sol:${side}|${code}`);
    const subject = ov?.subjectOverride?.trim() ? ov.subjectOverride : built.subject;
    const html = ov?.bodyOverride?.trim() ? wrapEditedBody(ov.bodyOverride) : built.html;

    return {
      ok: true,
      pipeline: "solicitor",
      recipientName: firmName ?? solContact?.name ?? `${side === "vendor" ? "Seller" : "Buyer"}'s solicitor`,
      recipientRole: `${side === "vendor" ? "Seller" : "Buyer"}'s solicitor`,
      subject,
      html,
    };
  }

  // Client pipeline — nudge digest to the client (buyer/seller).
  const clientRole = side; // vendor / purchaser contact roleType
  const contact = tx.contacts.find((c) => c.roleType === clientRole && c.portalToken);
  if (!contact || !contact.portalToken) return { ok: false, error: "No client with portal access to preview." };

  // The agency's own client-chase copy from settings (subject/intro/outro) — an
  // empty result falls back to our rotating default inside assembleDigestPayload,
  // so this is exactly what the send would use.
  const agencyCopy = await resolveClientChaseContent(tx.agencyId);
  const { subject, html } = assembleDigestPayload({
    transaction: { id: tx.id, propertyAddress: tx.propertyAddress },
    contact: { id: contact.id, name: contact.name, portalToken: contact.portalToken },
    milestones: [{ code }],
    agencyName: brand,
    recipientSide: side,
    agencyCopy,
  });

  return {
    ok: true,
    pipeline: "client",
    recipientName: contact.name,
    recipientRole: side === "vendor" ? "Seller" : "Buyer",
    subject,
    html,
  };
}
