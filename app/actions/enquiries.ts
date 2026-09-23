"use server";

// Server actions for the internal enquiries tracker panel (Stage 1.6).
// Every action verifies the transaction is in the caller's access scope
// (Law 7) before mutating.

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { getEnquiryHistory, type EnquiryHistoryEntry } from "@/lib/services/enquiries";
import { createCommunicationRecord } from "@/lib/services/comms";
import { confirmMilestoneAction } from "./milestones";
import { postEnquiryEcho } from "@/lib/services/chase-echo";
import { renderEditedChaseEmailHtml } from "@/lib/email/client-chase-digest";
import { resolveEmailTheme } from "@/lib/email/brand-theme";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { buildContactUnsubscribeUrl, buildContactPauseUrl } from "@/lib/email/unsubscribe";
import {
  logEnquiryMovement,
  setEnquiryOutstandingNote,
  setEnquirySnooze,
  setEnquirySnoozeUntil,
  type EnquiryCourt,
  type EnquiryMovementMode,
  type EnquiryMovementKind,
} from "@/lib/enquiries/tracker";

const courtLabel = (c: EnquiryCourt) =>
  c === "seller_solicitor" ? "the seller's solicitor" : "the buyer's solicitor";

async function assertInScope(transactionId: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorised");
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Not found");
  return session.user.id;
}

export async function logEnquiryMovementAction(input: {
  transactionId: string;
  note?: string;
  // "handover" (default) flips + resets the clock; "touch" resets without
  // flipping; "relabel" flips without touching the clock. See logEnquiryMovement.
  mode?: EnquiryMovementMode;
  flipsCourtTo?: EnquiryCourt | null;
  // Event type for the triage page's pills + history. Defaults to "update".
  kind?: EnquiryMovementKind;
  // Backdate: the day the event actually happened, when it wasn't today. ISO
  // date string (yyyy-mm-dd). Anchors the whole chase cadence to that day so a
  // "replies sent 3 days ago" makes the follow-up 3 days sooner. Clamped in the
  // tracker to [openedAt, now]; an invalid/blank value falls back to today.
  occurredAt?: string;
}): Promise<{ ok: boolean }> {
  const userId = await assertInScope(input.transactionId);
  const mode = input.mode ?? "handover";
  const flip = input.flipsCourtTo ?? null;
  // The note is optional (the hero slider is one tap). Synthesise a clear
  // history line when none is given, so the movement log always reads sensibly.
  const note =
    (input.note ?? "").trim() ||
    (input.kind === "partial_replies"
      ? "Some replies sent across"
      : mode === "touch"
        ? "They've been in touch, still with them"
        : mode === "relabel"
          ? `Corrected: now with ${flip ? courtLabel(flip) : "the other side"}`
          : `Now with ${flip ? courtLabel(flip) : "the other side"}`);
  let occurredAt: Date | undefined;
  if (input.occurredAt) {
    const d = new Date(input.occurredAt);
    if (!Number.isNaN(d.getTime())) occurredAt = d;
  }
  const ok = await logEnquiryMovement({
    transactionId: input.transactionId,
    note,
    // "touch" never moves it to the other side, whatever the caller sends.
    flipsCourtTo: mode === "touch" ? null : flip,
    mode,
    kind: input.kind,
    occurredAt,
    createdByUserId: userId,
  });
  // Mirror the meaningful enquiry movements onto the client portal(s) as a
  // passive, signed update. Replies-sent / partial / raised only; the internal
  // "still with them" touch stays silent (nothing changed for the client).
  if (ok && (input.kind === "replies_sent" || input.kind === "partial_replies" || input.kind === "raised")) {
    postEnquiryEcho({ transactionId: input.transactionId, kind: input.kind, actorUserId: userId }).catch(() => {});
  }
  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  revalidatePath("/agent/enquiries");
  return { ok };
}

// Log a manual chase (a call / an email we sent by hand). Resets the chase
// clock (so the auto-chase doesn't fire straight after) without moving the
// court, and shows in the history as "Chased by …".
export type EnquiryCallOutcome = "spoke" | "voicemail" | "no_answer";
export type EnquiryCallParty = "buyer" | "seller_solicitor" | "buyer_solicitor";

export async function logEnquiryChaseAction(input: {
  transactionId: string;
  method: "phone" | "email" | "other";
  // Detail from the logger. When present, the enquiry movement note is enriched AND
  // the chase is mirrored onto the file's activity feed (like logging a call/email
  // on the property file), so it's captured in both places.
  outcome?: EnquiryCallOutcome;
  note?: string;
  withParty?: EnquiryCallParty; // side/kind — used for defaulting + fallback label
  partyLabel?: string; // the real party name/firm chosen in the logger ("Collective Legal", "John Smith")
  contactId?: string; // set when the party is a client → links the activity-feed contact chip
}): Promise<{ ok: boolean }> {
  // Inline auth so we have the scope + role for the activity-feed mirror below.
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorised");
  const scope = getAccessScope(session);
  const owned = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, input.transactionId),
    select: { id: true },
  });
  if (!owned) throw new Error("Not found");
  const userId = session.user.id;

  const isPhone = input.method === "phone";
  const isEmail = input.method === "email";
  const trimmedNote = (input.note ?? "").trim();
  // Prefer the real chosen name/firm; fall back to the generic side label.
  const partyLabel =
    input.partyLabel?.trim() ||
    (input.withParty === "buyer" ? "the buyer"
      : input.withParty === "seller_solicitor" ? "the seller's solicitor"
        : input.withParty === "buyer_solicitor" ? "the buyer's solicitor"
          : null);
  const outcomeLabel =
    input.outcome === "voicemail" ? "left a voicemail"
      : input.outcome === "no_answer" ? "no answer"
        : input.outcome === "spoke" ? "spoke"
          : null;

  // Enquiry-timeline movement note (resets the chase clock via mode "touch").
  const verbNote = isPhone ? "Chased by phone" : isEmail ? "Chased by email" : "Chased";
  const note = [
    verbNote,
    partyLabel ? `with ${partyLabel}` : null,
    isPhone && outcomeLabel && input.outcome !== "spoke" ? `(${outcomeLabel})` : null,
    trimmedNote ? `· ${trimmedNote}` : null,
  ].filter(Boolean).join(" ");

  const ok = await logEnquiryMovement({
    transactionId: input.transactionId,
    note,
    mode: "touch",
    kind: "chased",
    createdByUserId: userId,
  });

  // Mirror a detailed phone/email chase onto the file's activity feed (same as
  // logging a call/email on the property file's activity tab), so the conversation
  // is captured there too. The "who" lives in the content since solicitor contacts
  // aren't Contact rows. Best-effort: a failure here never fails the chase itself.
  const hasDetail = trimmedNote || input.partyLabel || input.withParty || (isPhone && input.outcome);
  if (ok && (isPhone || isEmail) && hasDetail) {
    const verb = isPhone ? "Call" : "Email";
    const content =
      `${partyLabel ? `${verb} with ${partyLabel}` : verb} re enquiries` +
      (isPhone && outcomeLabel && input.outcome !== "spoke" ? ` (${outcomeLabel})` : "") +
      (trimmedNote ? `: ${trimmedNote}` : ".");
    try {
      await createCommunicationRecord({
        transactionId: input.transactionId,
        type: "outbound",
        method: isPhone ? (input.outcome === "voicemail" ? "voicemail" : "phone") : "email",
        contactIds: input.contactId ? [input.contactId] : [],
        content,
        visibleToClient: false,
        createdById: userId,
        createdByRole: session.user.role,
        scope,
      });
    } catch { /* activity-feed mirror is best-effort */ }
  }

  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  revalidatePath("/agent/enquiries");
  return { ok };
}

// Set (or clear) the expected-replies date. Reuses the "hold the chase until"
// mechanism — the date a solicitor gives IS the date we expect replies by.
export async function setEnquiryExpectedDateAction(input: {
  transactionId: string;
  date: string | null; // ISO date, or null to clear
}): Promise<{ ok: boolean }> {
  await assertInScope(input.transactionId);
  if (input.date) {
    await setEnquirySnoozeUntil(input.transactionId, new Date(input.date));
  } else {
    await setEnquirySnooze(input.transactionId, null);
  }
  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  revalidatePath("/agent/enquiries");
  return { ok: true };
}

// Mark the whole enquiries loop satisfied straight from the triage page. This is
// the real close, not a tracker-only flag: it confirms PM20 (buyer's "all
// enquiries satisfied"), which cascades to VM21 (the seller-side mirror) and
// closes the tracker via syncEnquiryTracker — the exact path the file milestone
// confirm runs. Delegating to confirmMilestoneAction (Law 4) means the exchange
// gate, the reminder re-eval, and the PM20 client email all stay correct rather
// than being re-implemented here. The tracker being open already implies PM14 is
// complete, so PM20's only prerequisite is satisfied.
export async function markEnquiriesSatisfiedAction(input: {
  transactionId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  await assertInScope(input.transactionId);
  const pm20 = await prisma.milestoneDefinition.findFirst({
    where: { code: "PM20" },
    select: { id: true },
  });
  if (!pm20) return { ok: false, reason: "PM20 milestone definition missing" };

  const res = await confirmMilestoneAction({
    transactionId: input.transactionId,
    milestoneDefinitionId: pm20.id,
  });
  // confirmMilestoneAction returns a { ok: false, kind: "prereqs_missing" }
  // shape when a direct prerequisite isn't committed yet, or its notifications
  // payload on success. Only surface the genuine prereqs case as that specific
  // message; any other failure gets a plain "didn't save" so we never send the
  // agent chasing the wrong thing (critique F6).
  if (res && typeof res === "object" && "ok" in res && res.ok === false) {
    const kind = (res as { kind?: string }).kind;
    return { ok: false, reason: kind === "prereqs_missing" ? "prereqs_missing" : "failed" };
  }
  revalidatePath("/agent/enquiries");
  return { ok: true };
}

// Load the chase-history timeline for one file's open loop (on row expand).
export async function getEnquiryHistoryAction(transactionId: string): Promise<EnquiryHistoryEntry[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return [];
  return getEnquiryHistory(getAccessScope(session), transactionId);
}

// Preview one chase email from the enquiry timeline, exactly as it was sent.
// Three sources, best first: (1) the archived HTML on rows that store it
// (branded solicitor sends from 2026-09-10); (2) for client chases, rebuild
// the branded shell from the stored plain-text body with the same helper the
// edit path uses, so it renders true-to-inbox; (3) a plain-text card as a last
// resort. Scope-checked via the transaction (Law 7).
export type EnquiryChaseEmail = {
  subject: string;
  recipientName: string;
  recipientEmail: string;
  html: string;
  sentAt: Date | null;
};
function plainBodyHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = text
    .split(/\r?\n\r?\n/)
    .map((b) => b.split(/\r?\n/).map(esc).join("<br />"))
    .filter((b) => b.trim().length > 0)
    .map((b) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${b}</p>`)
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#ffffff;">
  <div style="padding:24px 26px;">${paras || '<p style="margin:0;color:#6b7280;font-size:14px;">No body was recorded for this message.</p>'}</div>
</body></html>`;
}
export async function getEnquiryChaseEmailAction(
  messageId: string,
): Promise<{ ok: true; data: EnquiryChaseEmail } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "Not signed in." };
  const scope = getAccessScope(session);

  const msg = await prisma.outboundMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true, transactionId: true, subject: true, content: true, sentEmailHtml: true,
      recipientName: true, recipientEmail: true, contactIds: true, sentAt: true, createdAt: true,
    },
  });
  if (!msg || !msg.transactionId) return { ok: false, error: "Message not found." };

  // Multi-tenant guard: caller must be able to see the file this message is on.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, msg.transactionId),
    select: { id: true, agency: { select: { name: true } } },
  });
  if (!tx) return { ok: false, error: "Not found." };

  const subject = msg.subject ?? "(no subject)";
  const recipientName = msg.recipientName ?? "the recipient";
  const recipientEmail = msg.recipientEmail ?? "";
  const base = { subject, recipientName, recipientEmail, sentAt: msg.sentAt ?? msg.createdAt };

  // 1. Archived exact HTML.
  if (msg.sentEmailHtml) {
    return { ok: true, data: { ...base, html: msg.sentEmailHtml } };
  }

  // 2. Client chase → rebuild the branded shell from the stored body.
  const contactId = msg.contactIds?.[0] ?? null;
  const contact = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId }, select: { id: true, portalToken: true } })
    : null;
  if (contact?.portalToken && msg.content?.trim()) {
    const sender = await resolveAgencySenderForTransaction(tx.id, { persona: "personal" });
    const theme = sender.theme ?? resolveEmailTheme(null);
    const portalBase = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
    const html = renderEditedChaseEmailHtml({
      agencyName: tx.agency?.name ?? "Sales Progressor",
      subject,
      text: msg.content,
      respondUrl: `${portalBase}/portal/${contact.portalToken}/respond`,
      pauseUrl: buildContactPauseUrl(contact.id),
      unsubscribeUrl: buildContactUnsubscribeUrl(contact.id),
      theme,
    });
    return { ok: true, data: { ...base, html } };
  }

  // 3. Last resort: render whatever body text we stored, honestly.
  return { ok: true, data: { ...base, html: plainBodyHtml(msg.content ?? "") } };
}

export async function setEnquiryOutstandingAction(input: {
  transactionId: string;
  note: string | null;
}): Promise<{ ok: boolean }> {
  await assertInScope(input.transactionId);
  await setEnquiryOutstandingNote(input.transactionId, input.note);
  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}

export async function setEnquirySnoozeAction(input: {
  transactionId: string;
  workingDays: number | null;
}): Promise<{ ok: boolean }> {
  await assertInScope(input.transactionId);
  await setEnquirySnooze(input.transactionId, input.workingDays);
  revalidatePath(`/transactions/${input.transactionId}`);
  revalidatePath(`/agent/transactions/${input.transactionId}`);
  return { ok: true };
}
