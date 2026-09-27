"use server";

// AI Outreach server actions (Build Order F + G). Superadmin-only, thin auth
// wrappers over lib/outreach/* logic. NONE of these send email, assign prospects,
// or launch anything. Approval marks intent only; H does the external work and
// verifies the content hash first.

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { discoverAgencies } from "@/lib/outreach/discover";
import { verifyEmailDeliverable } from "@/lib/prospects/email-verify";
import { previewProspectOutreachHtml } from "@/lib/prospects/send";
import { buildProspectUnsubscribeUrl } from "@/lib/email/unsubscribe";
import { runStrategyCycle } from "@/lib/outreach/orchestrator";
import { preflightExperiment, launchExperiment, launchExperimentToProspects, resumeLaunch, type Preflight, type LaunchResult } from "@/lib/outreach/launch";
import {
  approveExperiment,
  rejectExperiment,
  discardExperiment,
  overrideReviewerReject,
  editExperiment,
  type EditPatch,
  type Ok,
  type Err,
  type ApproveResult,
} from "@/lib/outreach/approval-ops";

export type { EditPatch } from "@/lib/outreach/approval-ops";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}

const REVALIDATE = "/command/ai-outreach";

// ── F: generate ──────────────────────────────────────────────────────────────
export type GenerateProposalResult =
  | { ok: true; experimentId: string; status: string; reviewOutcome: string; revisionRan: boolean }
  | { ok: false; error: string };

export async function runStrategyCycleAction(): Promise<GenerateProposalResult> {
  const session = await requireSuperAdmin();
  const res = await runStrategyCycle({ actorUserId: session.user.id });
  if (!res.ok) return { ok: false, error: `${res.stage}: ${res.error}` };
  revalidatePath(REVALIDATE);
  return { ok: true, experimentId: res.experimentId, status: res.status, reviewOutcome: res.reviewOutcome, revisionRan: res.revisionRan };
}

// ── Find agents: discover UK estate agents we don't already hold, and feed them
// into the existing prospect-import pipeline (research + dedupe + create). The
// launch flow then sends the experiment to the newly-added prospects. Discovery
// only skips names we already hold; enrichment + dedupe happen in the pipeline.
export type FindAgentsResult =
  | { ok: true; batchId: string; found: number; agencies: { name: string; location: string }[] }
  | { ok: false; error: string };

export async function findAgentsAction(area: string, count: number): Promise<FindAgentsResult> {
  const session = await requireSuperAdmin();
  const a = area.trim();
  if (!a) return { ok: false, error: "Enter an area to search (for example Kent, or Leeds)." };
  const n = Math.max(1, Math.min(50, Math.floor(count) || 25));

  // Names we already hold, so discovery doesn't return duplicates.
  const existing = await commandDb.prospect.findMany({ select: { agencyName: true } });
  const excludeNames = existing.map((p) => p.agencyName).filter(Boolean);

  let discovered: { name: string; location: string }[];
  try {
    discovered = await discoverAgencies(a, n, excludeNames);
  } catch (err) {
    console.error("[find-agents] discovery failed", err);
    return { ok: false, error: "Could not search for agents just now. Try again." };
  }
  if (discovered.length === 0) return { ok: false, error: "No new agents found for that area. Try a broader area." };

  // Feed them into the existing import batch pipeline. The enrichment step
  // researches, dedupes and creates each prospect; the UI loop below drives it,
  // and the prospect-import-drain cron finishes anything left.
  const batch = await commandDb.prospectImportBatch.create({
    data: {
      createdById: session.user.id,
      total: discovered.length,
      status: "processing",
      items: { create: discovered.map((d) => ({ inputAgency: d.name, inputLocation: d.location })) },
    },
  });
  revalidatePath("/command/prospects");
  return { ok: true, batchId: batch.id, found: discovered.length, agencies: discovered };
}

// ── Review the found batch: the reviewable rows behind a Find agents run, with
// a per-address deliverability badge so you can drop the guessed/dead ones
// before publishing. Superadmin-only, read-only.
export type FoundRow = {
  prospectId: string;
  agencyName: string;
  location: string | null;
  contactName: string | null;
  jobTitle: string | null;
  email: string | null;
  emailStatus: "verified" | "guessed" | "invalid" | "none";
};

async function buildFoundRows(ids: string[]): Promise<FoundRow[]> {
  if (ids.length === 0) return [];
  const prospects = await commandDb.prospect.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, agencyName: true, location: true, generalEmail: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1, select: { name: true, jobTitle: true, email: true, research: true } },
    },
  });

  const rows: FoundRow[] = [];
  for (const p of prospects) {
    const c = p.contacts[0];
    const email = c?.email ?? p.generalEmail ?? null;
    let emailStatus: FoundRow["emailStatus"] = "none";
    if (email) {
      const v = await verifyEmailDeliverable(email);
      if (v.status === "invalid") emailStatus = "invalid";
      else {
        const state = (c?.research as { email?: { state?: string } } | null)?.email?.state;
        emailStatus = state === "verified" || state === "confirmed" ? "verified" : "guessed";
      }
    }
    rows.push({
      prospectId: p.id, agencyName: p.agencyName, location: p.location,
      contactName: c?.name ?? null, jobTitle: c?.jobTitle ?? null, email, emailStatus,
    });
  }
  // Deliverable first, then guessed, then problems — so the good ones read at the top.
  const order: Record<FoundRow["emailStatus"], number> = { verified: 0, guessed: 1, invalid: 2, none: 3 };
  rows.sort((a, b) => order[a.emailStatus] - order[b.emailStatus] || a.agencyName.localeCompare(b.agencyName));
  return rows;
}

async function prospectIdsForBatches(batchIds: string[]): Promise<string[]> {
  const items = await commandDb.prospectImportItem.findMany({
    where: { batchId: { in: batchIds }, prospectId: { not: null } },
    select: { prospectId: true },
  });
  return [...new Set(items.map((i) => i.prospectId).filter((v): v is string => !!v))];
}

export async function getBatchProspectsAction(batchId: string): Promise<FoundRow[]> {
  await requireSuperAdmin();
  return buildFoundRows(await prospectIdsForBatches([batchId]));
}

// Rebuild the review list for one or more found batches — drives persistence, so
// leaving the page and returning re-shows the agents tied to the experiment.
export async function getBatchesProspectsAction(batchIds: string[]): Promise<FoundRow[]> {
  await requireSuperAdmin();
  if (batchIds.length === 0) return [];
  return buildFoundRows(await prospectIdsForBatches(batchIds));
}

// The exact HTML of one outreach email, for the Sends results-lab popup. A sent
// email renders from its stored (personalised) body; a still-queued one from its
// frozen copy. Faithful to what the recipient sees (signature + footer).
export async function getSendEmailHtmlAction(
  ref: { emailId?: string | null; stepId?: string | null },
): Promise<{ ok: true; subject: string; html: string; toEmail: string | null } | { ok: false; error: string }> {
  await requireSuperAdmin();
  if (ref.emailId) {
    const e = await commandDb.prospectEmail.findUnique({ where: { id: ref.emailId }, select: { subject: true, body: true, html: true, toEmail: true, prospectId: true } });
    if (!e) return { ok: false, error: "Email not found." };
    const html = e.html && e.html.trim() ? e.html : previewProspectOutreachHtml(e.body, buildProspectUnsubscribeUrl(e.prospectId));
    return { ok: true, subject: e.subject, html, toEmail: e.toEmail };
  }
  if (ref.stepId) {
    const s = await commandDb.prospectFlowStep.findUnique({ where: { id: ref.stepId }, select: { subject: true, body: true, toEmail: true, flow: { select: { prospectId: true } } } });
    if (!s || !s.body) return { ok: false, error: "Email not found." };
    const html = previewProspectOutreachHtml(s.body, buildProspectUnsubscribeUrl(s.flow.prospectId));
    return { ok: true, subject: s.subject ?? "(no subject)", html, toEmail: s.toEmail };
  }
  return { ok: false, error: "Nothing to show." };
}

// Publish an approved experiment to exactly the reviewed prospects (the kept
// rows) — not the whole list. Split by the approved allocation (A/B).
export async function publishCampaignAction(experimentId: string, prospectIds: string[]): Promise<LaunchResult> {
  const session = await requireSuperAdmin();
  const res = await launchExperimentToProspects({ experimentId, prospectIds, actorUserId: session.user.id });
  if ("ok" in res && res.ok) revalidatePath(REVALIDATE);
  return res;
}

// Correct a found agent's contact name / email inline on the review screen (e.g.
// after sleuthing out the real address for a guessed or blank row). Writes to
// the primary contact; a manually entered email is recorded as human-confirmed,
// and the deliverability badge is recomputed and returned.
export async function updateFoundProspectAction(
  prospectId: string,
  patch: { contactName: string | null; email: string | null },
): Promise<{ ok: true; contactName: string | null; email: string | null; emailStatus: FoundRow["emailStatus"] } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const email = patch.email?.trim() || null;
  const name = patch.contactName?.trim() || null;

  const p = await commandDb.prospect.findUnique({
    where: { id: prospectId },
    select: { id: true, contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1, select: { id: true, name: true, research: true } } },
  });
  if (!p) return { ok: false, error: "Prospect not found." };
  const primary = p.contacts[0] ?? null;

  // A manually entered email is human-confirmed — record that in the provenance
  // so the badge reflects it now and on any future review.
  const confirmedResearch = {
    ...((primary?.research as Record<string, unknown> | null) ?? {}),
    email: { state: "confirmed", note: "manually entered", researchedAt: new Date().toISOString() },
  } as Prisma.InputJsonValue;

  if (primary) {
    await commandDb.prospectContact.update({
      where: { id: primary.id },
      data: { name: name ?? primary.name, email, ...(email ? { research: confirmedResearch } : {}) },
    });
  } else {
    await commandDb.prospectContact.create({
      data: { prospectId, name: name ?? "Contact", email, isPrimary: true, ...(email ? { research: confirmedResearch } : {}) },
    });
  }

  let emailStatus: FoundRow["emailStatus"] = "none";
  if (email) {
    const v = await verifyEmailDeliverable(email);
    emailStatus = v.status === "invalid" ? "invalid" : "verified";
  }
  return { ok: true, contactName: name, email, emailStatus };
}

// ── G: approval workflow ─────────────────────────────────────────────────────
export async function editExperimentAction(experimentId: string, patch: EditPatch): Promise<Ok | Err> {
  const session = await requireSuperAdmin();
  const res = await editExperiment(experimentId, session.user.id, patch);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function approveExperimentAction(experimentId: string, opts?: { confirmInfeasible?: boolean }): Promise<ApproveResult> {
  const session = await requireSuperAdmin();
  const res = await approveExperiment(experimentId, session.user.id, opts);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function rejectExperimentAction(experimentId: string, reason?: string): Promise<Ok | Err> {
  await requireSuperAdmin();
  const res = await rejectExperiment(experimentId, reason);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function discardExperimentAction(experimentId: string): Promise<Ok | Err> {
  await requireSuperAdmin();
  const res = await discardExperiment(experimentId);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function overrideReviewerRejectAction(experimentId: string, reason: string): Promise<Ok | Err> {
  const session = await requireSuperAdmin();
  const res = await overrideReviewerReject(experimentId, session.user.id, reason);
  if (res.ok) revalidatePath(REVALIDATE);
  return res;
}

// ── H: launch (preflight / launch / resume) ──────────────────────────────────
// These use the real SendGrid transport in production. Per the Build Order H
// gate, a real end-to-end email test is separately approved; this is not invoked
// during verification (tests drive lib/outreach/launch with a mocked transport).

export async function preflightExperimentAction(experimentId: string): Promise<Preflight | { error: string }> {
  await requireSuperAdmin();
  return preflightExperiment(experimentId);
}

export async function launchExperimentAction(experimentId: string, opts?: { confirmUnderSample?: boolean }): Promise<LaunchResult> {
  const session = await requireSuperAdmin();
  const res = await launchExperiment({ experimentId, actorUserId: session.user.id, confirmUnderSample: opts?.confirmUnderSample });
  if ("ok" in res && res.ok) revalidatePath(REVALIDATE);
  return res;
}

export async function resumeLaunchAction(experimentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  await resumeLaunch({ experimentId });
  revalidatePath(REVALIDATE);
  return { ok: true };
}
