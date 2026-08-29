"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { redirect } from "next/navigation";
import { commandDb } from "@/lib/command/prisma";
import {
  getProspectDetail, getConvertedAgencyStats, searchAgenciesForConversion, searchProspectGroups,
  type ProspectDetail, type ConvertedAgencyStats, type AgencyMatch, type GroupMatch,
} from "@/lib/command/prospects";
import { CALL_OUTCOMES, CALL_OUTCOME_LABEL, LOST_REASONS } from "@/lib/command/prospect-labels";
import { anthropic } from "@/lib/anthropic";
import { buildTemplate } from "@/lib/prospects/templates";
import { sendProspectOutreach } from "@/lib/prospects/send";
import { researchAgency, type ResearchField } from "@/lib/prospects/research";
import { randomUUID } from "crypto";
import type { Prisma, ProspectStatus, ProspectSource, ProspectLostReason } from "@prisma/client";

// Command Centre → Prospects server actions. Every action is superadmin-gated
// and writes through commandDb. Meaningful changes also append a ProspectActivity
// row so the drawer timeline is the single chronological history.

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

async function logActivity(
  prospectId: string,
  actorUserId: string | null,
  type: string,
  summary: string | null,
  body?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await commandDb.prospectActivity.create({
    data: { prospectId, actorUserId, type, summary, body: body ?? null, metadata },
  });
}

const trimOrNull = (v: string | undefined | null) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

export async function getProspectDetailAction(id: string): Promise<ProspectDetail | null> {
  await requireSuperAdmin();
  return getProspectDetail(id);
}

export async function createProspectAction(input: {
  agencyName: string;
  branch?: string;
  website?: string;
  location?: string;
  postcode?: string;
  phone?: string;
  generalEmail?: string;
  source: string;
  notes?: string;
  // Optional first contact
  contactName?: string;
  contactJobTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const agencyName = input.agencyName.trim();
  if (!agencyName) return { ok: false, error: "An agency name is required." };
  const source = (["cold", "google", "linkedin", "referral", "chain", "solicitor", "existing_contact", "inbound", "other"].includes(input.source) ? input.source : "other") as ProspectSource;

  const hasContact = !!input.contactName?.trim();
  const prospect = await commandDb.prospect.create({
    data: {
      agencyName,
      branch: trimOrNull(input.branch),
      website: trimOrNull(input.website),
      location: trimOrNull(input.location),
      postcode: trimOrNull(input.postcode),
      phone: trimOrNull(input.phone),
      generalEmail: trimOrNull(input.generalEmail),
      source,
      notes: trimOrNull(input.notes),
      ownerUserId: session.user.id,
      createdById: session.user.id,
      ...(hasContact
        ? {
            contacts: {
              create: {
                name: input.contactName!.trim(),
                jobTitle: trimOrNull(input.contactJobTitle),
                email: trimOrNull(input.contactEmail),
                phone: trimOrNull(input.contactPhone),
                isPrimary: true,
              },
            },
          }
        : {}),
    },
  });
  await logActivity(prospect.id, session.user.id, "created", `Prospect added${hasContact ? ` with contact ${input.contactName!.trim()}` : ""}`);
  revalidatePath("/command/prospects");
  return { ok: true, id: prospect.id };
}

export async function updateProspectAction(id: string, patch: {
  agencyName?: string; branch?: string; website?: string; location?: string;
  postcode?: string; phone?: string; generalEmail?: string; branchCount?: number | null; sizeNote?: string; notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const agencyName = patch.agencyName?.trim();
  if (patch.agencyName !== undefined && !agencyName) return { ok: false, error: "Agency name can't be empty." };
  await commandDb.prospect.update({
    where: { id },
    data: {
      ...(agencyName ? { agencyName } : {}),
      ...(patch.branch !== undefined ? { branch: trimOrNull(patch.branch) } : {}),
      ...(patch.website !== undefined ? { website: trimOrNull(patch.website) } : {}),
      ...(patch.location !== undefined ? { location: trimOrNull(patch.location) } : {}),
      ...(patch.postcode !== undefined ? { postcode: trimOrNull(patch.postcode) } : {}),
      ...(patch.phone !== undefined ? { phone: trimOrNull(patch.phone) } : {}),
      ...(patch.generalEmail !== undefined ? { generalEmail: trimOrNull(patch.generalEmail) } : {}),
      ...(patch.branchCount !== undefined ? { branchCount: patch.branchCount } : {}),
      ...(patch.sizeNote !== undefined ? { sizeNote: trimOrNull(patch.sizeNote) } : {}),
      ...(patch.notes !== undefined ? { notes: trimOrNull(patch.notes) } : {}),
    },
  });
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function changeProspectStatusAction(id: string, toStatus: string, note?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const valid: ProspectStatus[] = ["new", "contacted", "replied", "interested", "trial", "active", "lost"];
  if (!valid.includes(toStatus as ProspectStatus)) return { ok: false, error: "Unknown status." };
  const current = await commandDb.prospect.findUnique({ where: { id }, select: { status: true } });
  if (!current) return { ok: false, error: "Prospect not found." };
  await commandDb.prospect.update({ where: { id }, data: { status: toStatus as ProspectStatus } });
  await logActivity(id, session.user.id, "status_changed", `${current.status} → ${toStatus}`, note ?? null, { fromStatus: current.status, toStatus });
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function addProspectNoteAction(id: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const text = body.trim();
  if (!text) return { ok: false, error: "Note can't be empty." };
  await logActivity(id, session.user.id, "note", text.slice(0, 80), text);
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function addProspectContactAction(prospectId: string, input: {
  name: string; jobTitle?: string; email?: string; phone?: string; linkedinUrl?: string; isDecisionMaker?: boolean; makePrimary?: boolean; shared?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Contact name is required." };

  // Shared contact: lives on the business group, so it shows on every branch.
  if (input.shared) {
    const p = await commandDb.prospect.findUnique({ where: { id: prospectId }, select: { groupId: true } });
    if (!p?.groupId) return { ok: false, error: "Add this prospect to a business first, then you can share a contact across its branches." };
    await commandDb.prospectContact.create({
      data: {
        groupId: p.groupId, name, jobTitle: trimOrNull(input.jobTitle), email: trimOrNull(input.email),
        phone: trimOrNull(input.phone), linkedinUrl: trimOrNull(input.linkedinUrl),
        isDecisionMaker: !!input.isDecisionMaker, isPrimary: false,
      },
    });
    await logActivity(prospectId, session.user.id, "contact_added", `Added shared contact ${name}`);
    revalidatePath("/command/prospects");
    return { ok: true };
  }

  const existingPrimary = await commandDb.prospectContact.count({ where: { prospectId, isPrimary: true } });
  const makePrimary = input.makePrimary || existingPrimary === 0;
  if (makePrimary) {
    await commandDb.prospectContact.updateMany({ where: { prospectId, isPrimary: true }, data: { isPrimary: false } });
  }
  await commandDb.prospectContact.create({
    data: {
      prospectId, name, jobTitle: trimOrNull(input.jobTitle), email: trimOrNull(input.email),
      phone: trimOrNull(input.phone), linkedinUrl: trimOrNull(input.linkedinUrl),
      isDecisionMaker: !!input.isDecisionMaker, isPrimary: makePrimary,
    },
  });
  await logActivity(prospectId, session.user.id, "contact_added", `Added contact ${name}`);
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function setPrimaryContactAction(prospectId: string, contactId: string): Promise<{ ok: true }> {
  await requireSuperAdmin();
  await commandDb.$transaction([
    commandDb.prospectContact.updateMany({ where: { prospectId, isPrimary: true }, data: { isPrimary: false } }),
    commandDb.prospectContact.update({ where: { id: contactId }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/command/prospects");
  return { ok: true };
}

// ─── Phase 2: calls, follow-ups, lost ────────────────────────────────────────

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function logProspectCallAction(id: string, input: {
  outcome: string; notes?: string; nextFollowUpAt?: string | null; newStatus?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const outcome = (CALL_OUTCOMES as readonly string[]).includes(input.outcome) ? input.outcome : "other";
  const current = await commandDb.prospect.findUnique({ where: { id }, select: { status: true } });
  if (!current) return { ok: false, error: "Prospect not found." };

  const validStatuses: ProspectStatus[] = ["new", "contacted", "replied", "interested", "trial", "active", "lost"];
  const newStatus = input.newStatus && validStatuses.includes(input.newStatus as ProspectStatus) ? (input.newStatus as ProspectStatus) : null;
  const followUp = input.nextFollowUpAt !== undefined ? parseDate(input.nextFollowUpAt) : undefined;

  await commandDb.prospect.update({
    where: { id },
    data: {
      lastContactedAt: new Date(),
      ...(followUp !== undefined ? { nextFollowUpAt: followUp } : {}),
      ...(newStatus ? { status: newStatus } : {}),
    },
  });
  await logActivity(id, session.user.id, "call_logged", `Call: ${CALL_OUTCOME_LABEL[outcome]}`, input.notes?.trim() || null, { outcome, ...(followUp ? { nextFollowUpAt: followUp.toISOString() } : {}) });
  if (newStatus && newStatus !== current.status) {
    await logActivity(id, session.user.id, "status_changed", `${current.status} → ${newStatus}`, null, { fromStatus: current.status, toStatus: newStatus });
  }
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function scheduleFollowUpAction(id: string, whenISO: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const when = parseDate(whenISO);
  if (!when) return { ok: false, error: "Pick a valid date." };
  await commandDb.prospect.update({ where: { id }, data: { nextFollowUpAt: when } });
  await logActivity(id, session.user.id, "follow_up_scheduled", `Follow-up set for ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, null, { when: when.toISOString() });
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function completeFollowUpAction(id: string): Promise<{ ok: true }> {
  const session = await requireSuperAdmin();
  await commandDb.prospect.update({ where: { id }, data: { nextFollowUpAt: null } });
  await logActivity(id, session.user.id, "follow_up_completed", "Follow-up cleared");
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function markProspectLostAction(id: string, reason: string, revisitISO?: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const lostReason = ((LOST_REASONS as readonly string[]).includes(reason) ? reason : "other") as ProspectLostReason;
  const revisit = parseDate(revisitISO);
  await commandDb.prospect.update({
    where: { id },
    data: { status: "lost", lostAt: new Date(), lostReason, revisitAt: revisit, nextFollowUpAt: null },
  });
  await logActivity(id, session.user.id, "lost", `Marked lost: ${reason}${revisit ? ` (revisit ${revisit.toLocaleDateString("en-GB", { day: "numeric", month: "short" })})` : ""}`, null, { reason, ...(revisit ? { revisitAt: revisit.toISOString() } : {}) });
  revalidatePath("/command/prospects");
  return { ok: true };
}

// ─── Phase 3: AI draft + send ────────────────────────────────────────────────

export async function draftFollowUpAction(prospectId: string, templateKey?: string): Promise<{ to: string | null; subject: string; body: string; aiGenerated: boolean }> {
  await requireSuperAdmin();
  const p = await commandDb.prospect.findUnique({
    where: { id: prospectId },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, activities: { orderBy: { occurredAt: "desc" }, take: 8 } },
  });
  if (!p) throw new Error("Prospect not found.");
  const primary = p.contacts[0] ?? null;
  const to = primary?.email ?? p.generalEmail ?? null;
  const firstName = (primary?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const ctx = { firstName, agencyName: p.agencyName, senderName: "Ellis" };

  if (templateKey) {
    const t = buildTemplate(templateKey, ctx);
    if (t) return { to, subject: t.subject, body: t.body, aiGenerated: false };
  }

  try {
    const context = [
      `Agency: ${p.agencyName}${p.location ? ` (${p.location})` : ""}`,
      `Contact: ${primary?.name ?? "unknown"}${primary?.jobTitle ? `, ${primary.jobTitle}` : ""}`,
      `Current status: ${p.status}`,
      `Follow-ups sent so far: ${p.followUpCount}`,
      p.notes ? `Notes: ${p.notes}` : "",
      `Recent history: ${p.activities.map((a) => a.summary).filter(Boolean).slice(0, 6).join("; ") || "none"}`,
    ].filter(Boolean).join("\n");
    const system = `You draft short, warm B2B follow-up emails from Ellis at The Sales Progressor, a UK service that runs estate agents' sales progression and chasing for them (charged only when a sale exchanges). Write to the contact by first name. Be specific to the context, friendly, and brief (under 120 words). Do NOT include a signature (it is added automatically). No em dashes. Return ONLY JSON: {"subject": "...", "body": "..."}.`;
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: context }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s !== -1 && e !== -1) {
      const parsed = JSON.parse(text.slice(s, e + 1)) as { subject?: string; body?: string };
      if (parsed.subject && parsed.body) return { to, subject: String(parsed.subject), body: String(parsed.body), aiGenerated: true };
    }
  } catch {
    // fall through to template
  }
  const fb = buildTemplate("cold_intro", ctx)!;
  return { to, subject: fb.subject, body: fb.body, aiGenerated: false };
}

export async function sendProspectEmailAction(prospectId: string, input: {
  contactId?: string; to: string; subject: string; body: string; aiGenerated?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const to = input.to.trim(), subject = input.subject.trim(), body = input.body.trim();
  if (!to || !subject || !body) return { ok: false, error: "To, subject and body are all required." };

  const p = await commandDb.prospect.findUnique({ where: { id: prospectId }, select: { optedOutAt: true, bouncedAt: true, status: true } });
  if (!p) return { ok: false, error: "Prospect not found." };
  if (p.optedOutAt) return { ok: false, error: "This prospect has opted out of email." };
  if (p.bouncedAt) return { ok: false, error: "A previous email to this prospect bounced." };

  const replyToken = randomUUID().replace(/-/g, "");
  const pe = await commandDb.prospectEmail.create({
    data: { prospectId, contactId: input.contactId ?? null, toEmail: to, subject, body, replyToken, aiGenerated: !!input.aiGenerated, createdById: session.user.id },
  });
  try {
    const { sgMessageId } = await sendProspectOutreach({ to, subject, text: body, replyToken, prospectEmailId: pe.id });
    await commandDb.prospectEmail.update({ where: { id: pe.id }, data: { sgMessageId } });
  } catch (err) {
    await commandDb.prospectEmail.delete({ where: { id: pe.id } }).catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 140) : "The email failed to send." };
  }

  await logActivity(prospectId, session.user.id, "email_sent", `Email: ${subject}`, body, { prospectEmailId: pe.id });
  await commandDb.prospect.update({
    where: { id: prospectId },
    data: { lastContactedAt: new Date(), followUpCount: { increment: 1 }, nextFollowUpAt: null, ...(p.status === "new" ? { status: "contacted" as ProspectStatus } : {}) },
  });
  revalidatePath("/command/prospects");
  return { ok: true };
}

// ─── Phase 4: conversion + chain leads + acquisition stats ───────────────────

// Link a prospect to the real agency it became. Sets the durable attribution
// (convertedAgencyId is @unique), flips status to active, and stamps the agency's
// signupSource for attribution if it isn't already set. Suggest-and-confirm: the
// UI proposes a match, this action does the linking once confirmed.
export async function convertProspectAction(prospectId: string, agencyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const agency = await commandDb.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true, isInternal: true, signupSource: true, prospect: { select: { id: true } } },
  });
  if (!agency) return { ok: false, error: "That agency wasn't found." };
  if (agency.isInternal) return { ok: false, error: "That's an internal agency, not a customer." };
  if (agency.prospect && agency.prospect.id !== prospectId) return { ok: false, error: "That agency is already linked to another prospect." };

  const p = await commandDb.prospect.findUnique({ where: { id: prospectId }, select: { source: true } });
  if (!p) return { ok: false, error: "Prospect not found." };

  await commandDb.prospect.update({
    where: { id: prospectId },
    data: { convertedAgencyId: agencyId, convertedAt: new Date(), status: "active", lostAt: null, lostReason: null, nextFollowUpAt: null },
  });
  if (!agency.signupSource) {
    await commandDb.agency.update({ where: { id: agencyId }, data: { signupSource: `prospect:${p.source}` } }).catch(() => {});
  }
  await logActivity(prospectId, session.user.id, "converted", `Won: now the agency ${agency.name}`, null, { agencyId, agencyName: agency.name });
  revalidatePath("/command/prospects");
  return { ok: true };
}

// Undo a conversion (mis-linked agency). Clears the attribution and drops the
// prospect back to interested so it re-enters the working set.
export async function unlinkProspectAction(prospectId: string): Promise<{ ok: true }> {
  const session = await requireSuperAdmin();
  await commandDb.prospect.update({
    where: { id: prospectId },
    data: { convertedAgencyId: null, convertedAt: null, status: "interested" },
  });
  await logActivity(prospectId, session.user.id, "note", "Conversion unlinked");
  revalidatePath("/command/prospects");
  return { ok: true };
}

// Pull a warm chain-invite lead into the prospects list as a real, workable
// prospect. sourceChainLinkId keeps the provenance so it never gets pulled twice.
export async function addChainStubAsProspectAction(chainLinkId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const existing = await commandDb.prospect.findFirst({ where: { sourceChainLinkId: chainLinkId }, select: { id: true } });
  if (existing) return { ok: false, error: "This chain lead is already a prospect." };

  const link = await commandDb.chainLink.findUnique({
    where: { id: chainLinkId },
    select: { stubAgencyName: true, stubAgentName: true, stubAgentEmail: true, stubAgentPhone: true, stubPropertyAddress: true },
  });
  if (!link?.stubAgentEmail) return { ok: false, error: "That chain lead has no email to work from." };

  const contactName = link.stubAgentName?.trim() || link.stubAgentEmail;
  const prospect = await commandDb.prospect.create({
    data: {
      agencyName: link.stubAgencyName?.trim() || link.stubAgentEmail,
      generalEmail: link.stubAgentEmail,
      phone: link.stubAgentPhone?.trim() || null,
      source: "chain",
      sourceChainLinkId: chainLinkId,
      ownerUserId: session.user.id,
      createdById: session.user.id,
      notes: link.stubPropertyAddress ? `Came in as a chain invite on ${link.stubPropertyAddress}.` : null,
      contacts: { create: { name: contactName, email: link.stubAgentEmail, phone: link.stubAgentPhone?.trim() || null, isPrimary: true } },
    },
  });
  await logActivity(prospect.id, session.user.id, "created", `Added from a chain invite${link.stubAgencyName ? ` (${link.stubAgencyName.trim()})` : ""}`);
  revalidatePath("/command/prospects");
  return { ok: true, id: prospect.id };
}

export async function searchAgenciesAction(q: string): Promise<AgencyMatch[]> {
  await requireSuperAdmin();
  return searchAgenciesForConversion(q);
}

export async function getConvertedAgencyStatsAction(agencyId: string): Promise<ConvertedAgencyStats> {
  await requireSuperAdmin();
  return getConvertedAgencyStats(agencyId);
}

// ─── Groups (multi-branch businesses) ────────────────────────────────────────

export async function searchGroupsAction(q: string): Promise<GroupMatch[]> {
  await requireSuperAdmin();
  return searchProspectGroups(q);
}

// Create a business/brand and put this prospect (branch) under it in one step.
export async function createGroupAndLinkAction(prospectId: string, name: string): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const groupName = name.trim();
  if (!groupName) return { ok: false, error: "A business name is required." };
  const prospect = await commandDb.prospect.findUnique({ where: { id: prospectId }, select: { id: true } });
  if (!prospect) return { ok: false, error: "Prospect not found." };
  const group = await commandDb.prospectGroup.create({
    data: { name: groupName, ownerUserId: session.user.id, createdById: session.user.id, prospects: { connect: { id: prospectId } } },
  });
  await logActivity(prospectId, session.user.id, "note", `Grouped under ${groupName}`);
  revalidatePath("/command/prospects");
  return { ok: true, groupId: group.id };
}

export async function linkProspectToGroupAction(prospectId: string, groupId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const group = await commandDb.prospectGroup.findUnique({ where: { id: groupId }, select: { name: true } });
  if (!group) return { ok: false, error: "That business wasn't found." };
  await commandDb.prospect.update({ where: { id: prospectId }, data: { groupId } });
  await logActivity(prospectId, session.user.id, "note", `Grouped under ${group.name}`);
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function unlinkProspectFromGroupAction(prospectId: string): Promise<{ ok: true }> {
  const session = await requireSuperAdmin();
  await commandDb.prospect.update({ where: { id: prospectId }, data: { groupId: null } });
  await logActivity(prospectId, session.user.id, "note", "Removed from its business");
  revalidatePath("/command/prospects");
  return { ok: true };
}

// ─── Field verification (confirm / edit a researched field) ──────────────────

type FieldTarget = { target: "prospect" | "contact"; id: string; field: string };

const PROSPECT_EDITABLE = new Set(["agencyName", "branch", "website", "location", "postcode", "phone", "generalEmail", "sizeNote", "notes"]);
const CONTACT_EDITABLE = new Set(["name", "jobTitle", "email", "phone"]);
const REQUIRED_FIELDS = new Set(["agencyName", "name"]);

function setFieldState(research: unknown, field: string, state: "confirmed"): Record<string, unknown> {
  const map = { ...((research as Record<string, Record<string, unknown>> | null) ?? {}) };
  map[field] = { ...(map[field] ?? {}), state };
  return map;
}

// Confirm a NEEDS_CHECK field as personally reviewed — flips it to MANUALLY_CONFIRMED
// so it stops flagging and is never overwritten by later automated research.
export async function confirmFieldAction(input: FieldTarget): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const { target, id, field } = input;
  if (target === "prospect") {
    const p = await commandDb.prospect.findUnique({ where: { id }, select: { research: true } });
    if (!p) return { ok: false, error: "Prospect not found." };
    await commandDb.prospect.update({ where: { id }, data: { research: setFieldState(p.research, field, "confirmed") as Prisma.InputJsonValue } });
  } else {
    const c = await commandDb.prospectContact.findUnique({ where: { id }, select: { research: true } });
    if (!c) return { ok: false, error: "Contact not found." };
    await commandDb.prospectContact.update({ where: { id }, data: { research: setFieldState(c.research, field, "confirmed") as Prisma.InputJsonValue } });
  }
  revalidatePath("/command/prospects");
  return { ok: true };
}

// Correct a field's value and confirm it in one step.
export async function editFieldAction(input: FieldTarget & { value: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const { target, id, field } = input;
  const value = input.value.trim();
  if (REQUIRED_FIELDS.has(field) && !value) return { ok: false, error: "That field can't be empty." };
  const dataValue = REQUIRED_FIELDS.has(field) ? value : value || null;

  if (target === "prospect") {
    if (!PROSPECT_EDITABLE.has(field)) return { ok: false, error: "That field can't be edited here." };
    const p = await commandDb.prospect.findUnique({ where: { id }, select: { research: true } });
    if (!p) return { ok: false, error: "Prospect not found." };
    await commandDb.prospect.update({ where: { id }, data: { [field]: dataValue, research: setFieldState(p.research, field, "confirmed") as Prisma.InputJsonValue } as Prisma.ProspectUpdateInput });
  } else {
    if (!CONTACT_EDITABLE.has(field)) return { ok: false, error: "That field can't be edited here." };
    const c = await commandDb.prospectContact.findUnique({ where: { id }, select: { research: true } });
    if (!c) return { ok: false, error: "Contact not found." };
    await commandDb.prospectContact.update({ where: { id }, data: { [field]: dataValue, research: setFieldState(c.research, field, "confirmed") as Prisma.InputJsonValue } as Prisma.ProspectContactUpdateInput });
  }
  revalidatePath("/command/prospects");
  return { ok: true };
}

// ─── Contact edit / delete ───────────────────────────────────────────────────

export async function updateProspectContactAction(contactId: string, patch: {
  name?: string; jobTitle?: string; email?: string; phone?: string; linkedinUrl?: string; isDecisionMaker?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) return { ok: false, error: "Contact name can't be empty." };
  await commandDb.prospectContact.update({
    where: { id: contactId },
    data: {
      ...(name ? { name } : {}),
      ...(patch.jobTitle !== undefined ? { jobTitle: trimOrNull(patch.jobTitle) } : {}),
      ...(patch.email !== undefined ? { email: trimOrNull(patch.email) } : {}),
      ...(patch.phone !== undefined ? { phone: trimOrNull(patch.phone) } : {}),
      ...(patch.linkedinUrl !== undefined ? { linkedinUrl: trimOrNull(patch.linkedinUrl) } : {}),
      ...(patch.isDecisionMaker !== undefined ? { isDecisionMaker: patch.isDecisionMaker } : {}),
    },
  });
  revalidatePath("/command/prospects");
  return { ok: true };
}

export async function deleteProspectContactAction(contactId: string): Promise<{ ok: true }> {
  await requireSuperAdmin();
  await commandDb.prospectContact.delete({ where: { id: contactId } });
  revalidatePath("/command/prospects");
  return { ok: true };
}

// ─── Automated research (Phase B) ────────────────────────────────────────────

function metaFrom(rf: ResearchField, at: string) {
  return { state: rf.state, sourceName: rf.sourceName, sourceUrl: rf.sourceUrl, confidence: rf.confidence, note: rf.note, researchedAt: at };
}

// Research one prospect and apply the result. Fill-blanks-only + never overwrite
// a MANUALLY_CONFIRMED field, so this is safe to re-run (the later Companies-House
// sweep). Existing values are left alone; only empty fields get filled.
export async function researchProspectAction(prospectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const p = await commandDb.prospect.findUnique({
    where: { id: prospectId },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
  });
  if (!p) return { ok: false, error: "Prospect not found." };

  let result;
  try {
    result = await researchAgency(p.agencyName, p.location);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 160) : "Research failed." };
  }

  const at = new Date().toISOString();
  const research = { ...((p.research as Record<string, Record<string, unknown>> | null) ?? {}) };
  const data: Record<string, unknown> = {};
  const fill = (field: string, current: string | null, rf?: ResearchField | null) => {
    if (!rf?.value) return;
    if ((research[field]?.state as string) === "confirmed") return; // never overwrite confirmed
    if (current && current.trim()) return; // fill blanks only
    data[field] = rf.value;
    research[field] = metaFrom(rf, at);
  };
  fill("location", p.location, result.agency.location);
  fill("postcode", p.postcode, result.agency.postcode);
  fill("website", p.website, result.agency.website);
  fill("phone", p.phone, result.agency.phone);
  fill("generalEmail", p.generalEmail, result.agency.generalEmail);
  if (result.notes && !(p.notes && p.notes.trim())) data.notes = result.notes;
  data.research = research;
  await commandDb.prospect.update({ where: { id: prospectId }, data: data as Prisma.ProspectUpdateInput });

  // Contact: create the primary from the researched decision-maker if none yet;
  // otherwise fill blanks on the existing primary.
  const c = result.contact;
  if (c?.name?.value) {
    if (p.contacts.length === 0) {
      const cResearch: Record<string, ReturnType<typeof metaFrom>> = { name: metaFrom(c.name, at) };
      if (c.role) cResearch.jobTitle = metaFrom(c.role, at);
      if (c.email) cResearch.email = metaFrom(c.email, at);
      if (c.phone) cResearch.phone = metaFrom(c.phone, at);
      await commandDb.prospectContact.create({
        data: {
          prospectId, name: c.name.value, jobTitle: c.role?.value ?? null, email: c.email?.value ?? null,
          phone: c.phone?.value ?? null, isDecisionMaker: !!c.isDecisionMaker, isPrimary: true,
          research: cResearch as Prisma.InputJsonValue,
        },
      });
    } else {
      const primary = p.contacts[0];
      const pr = { ...((primary.research as Record<string, Record<string, unknown>> | null) ?? {}) };
      const cdata: Record<string, unknown> = {};
      const fillC = (field: string, current: string | null, rf?: ResearchField | null) => {
        if (!rf?.value) return;
        if ((pr[field]?.state as string) === "confirmed") return;
        if (current && current.trim()) return;
        cdata[field] = rf.value;
        pr[field] = metaFrom(rf, at);
      };
      fillC("jobTitle", primary.jobTitle, c.role);
      fillC("email", primary.email, c.email);
      fillC("phone", primary.phone, c.phone);
      cdata.research = pr;
      await commandDb.prospectContact.update({ where: { id: primary.id }, data: cdata as Prisma.ProspectContactUpdateInput });
    }
  }

  await logActivity(prospectId, session.user.id, "note", `Auto-researched${result.companyNumber ? ` (Companies House ${result.companyNumber})` : ""}`);
  revalidatePath("/command/prospects");
  return { ok: true };
}
