// The prospect batch-import engine, shared by the Command Centre server actions
// (tab-driven, one item per request) and the drain cron (finishes abandoned
// batches server-side). No "use server" and no auth here: callers own that.
//
// Robustness model: items are claimed atomically (pending -> researching) so the
// tab loop and the cron can run at once without double-processing. An item stuck
// in "researching" past a timeout (its request died mid-research) is reclaimed
// back to pending, capped by an attempts counter so a permanently-bad row fails
// rather than looping forever.

import { commandDb } from "@/lib/command/prisma";
import { researchAgency, type ResearchField, type ResearchResult } from "@/lib/prospects/research";
import type { Prisma } from "@prisma/client";

export const IMPORT_MAX = 15; // tuned for ~10; a single number to lift later.
const STALE_RESEARCHING_MS = 5 * 60_000; // a claim older than this is presumed dead
const MAX_ATTEMPTS = 3;

// ─── Normalisation + brand matching ──────────────────────────────────────────

export const normName = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/\b(ltd|limited|llp|plc)\b/g, "").replace(/[^a-z0-9]/g, "");
const normLoc = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normDomain = (url: string | null | undefined) =>
  url ? url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].trim() : "";

// Descriptor words stripped so branch names collapse to a shared brand key:
// "Acorn New Homes", "Acorn Estate Agents" and "Acorn (Dartford)" all -> "acorn".
const DESCRIPTORS = [
  "new homes", "estate agents", "estate agency", "estate agent", "estates", "estate",
  "lettings", "letting", "properties", "property", "residential", "homes", "sales",
  "group", "and", "the",
];
function brandKey(name: string | null | undefined): string {
  let s = (name ?? "").toLowerCase();
  s = s.replace(/\([^)]*\)/g, " "); // drop bracketed parts, e.g. "(Dartford)"
  s = s.replace(/\b(ltd|limited|llp|plc)\b/g, " ");
  for (const d of DESCRIPTORS) s = s.replace(new RegExp(`\\b${d}\\b`, "g"), " ");
  return s.replace(/[^a-z0-9]/g, "");
}

// ─── Parse ───────────────────────────────────────────────────────────────────

export function parseImportLines(raw: string): Array<{ agency: string; location: string | null }> {
  const out: Array<{ agency: string; location: string | null }> = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split("|").map((s) => s.trim());
    if (!parts[0]) continue;
    out.push({ agency: parts[0], location: parts[1] || null });
    if (out.length >= IMPORT_MAX) break;
  }
  return out;
}

// ─── Research apply (fill-blanks-only) ───────────────────────────────────────

function metaFrom(rf: ResearchField, at: string) {
  return { state: rf.state, sourceName: rf.sourceName, sourceUrl: rf.sourceUrl, confidence: rf.confidence, note: rf.note, researchedAt: at };
}

// Apply a research result to a prospect: fill-blanks-only, never overwrite a
// confirmed field. Creates the primary contact from the researched decision-maker
// if none exists, else fills blanks on the existing primary.
export async function applyResearchToProspect(prospectId: string, result: ResearchResult): Promise<void> {
  const p = await commandDb.prospect.findUnique({
    where: { id: prospectId },
    include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
  });
  if (!p) return;

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
}

// ─── Import one agency (research + dedupe + brand grouping) ──────────────────

function importReviewNeeded(result: ResearchResult): boolean {
  const fields = [result.agency.website, result.agency.phone, result.agency.generalEmail, result.agency.location, result.agency.postcode, result.contact?.name, result.contact?.role, result.contact?.email, result.contact?.phone];
  const anyNeedsCheck = fields.some((f) => f?.state === "needs_check");
  const missingKey = !result.agency.website || !result.agency.phone || !result.contact;
  return anyNeedsCheck || missingKey;
}

export async function importOne(
  agency: string,
  location: string | null,
  createdById: string | null,
): Promise<{ status: "imported" | "needs_review" | "exists"; prospectId?: string }> {
  const candidates = await commandDb.prospect.findMany({
    where: { archivedAt: null },
    select: { id: true, agencyName: true, location: true, website: true, groupId: true },
  });
  const nName = normName(agency);
  const nLoc = normLoc(location);

  // Cheap pre-check: an exact branch (same name + same location) already exists.
  const preMatch = candidates.find((c) => nName && normName(c.agencyName) === nName && normLoc(c.location) === nLoc);
  if (preMatch) return { status: "exists", prospectId: preMatch.id };

  const result = await researchAgency(agency, location);
  const domain = normDomain(result.agency.website?.value ?? null);
  const tradingName = result.agency.tradingName?.value || agency;
  const nTrade = normName(tradingName);
  const ckThis = brandKey(tradingName);
  const effLoc = normLoc(location || result.agency.location?.value || "");

  // Same-company candidates. Strongest signal is a shared website domain; if both
  // sides have a domain and they differ, that's positive evidence they are NOT
  // the same company, so never group. Otherwise fall back to brand-key / name.
  const sameCompany = candidates.filter((c) => {
    const cDomain = normDomain(c.website);
    if (domain && cDomain) return domain === cDomain;
    if (ckThis.length >= 4 && ckThis === brandKey(c.agencyName)) return true;
    if (nTrade && normName(c.agencyName) === nTrade) return true;
    if (nName && normName(c.agencyName) === nName) return true;
    return false;
  });
  const sameBranch = sameCompany.find((c) => normLoc(c.location) === effLoc);
  if (sameBranch) return { status: "exists", prospectId: sameBranch.id };

  const created = await commandDb.prospect.create({
    data: {
      agencyName: tradingName,
      location: location || result.agency.location?.value || null,
      source: "cold",
      ownerUserId: createdById, createdById,
    },
  });

  // Different branch of a company we already have -> put them in one business.
  if (sameCompany.length > 0) {
    const sibling = sameCompany[0];
    if (sibling.groupId) {
      await commandDb.prospect.update({ where: { id: created.id }, data: { groupId: sibling.groupId } });
    } else {
      await commandDb.prospectGroup.create({
        data: { name: tradingName, ownerUserId: createdById, createdById, prospects: { connect: [{ id: sibling.id }, { id: created.id }] } },
      });
    }
  }

  await applyResearchToProspect(created.id, result);
  await commandDb.prospectActivity.create({
    data: { prospectId: created.id, actorUserId: createdById, type: "created", summary: `Imported via research${result.companyNumber ? ` (Companies House ${result.companyNumber})` : ""}` },
  });
  return { status: importReviewNeeded(result) ? "needs_review" : "imported", prospectId: created.id };
}

// ─── Queue processing (atomic claim + stale reclaim + finalise) ──────────────

// Reclaim items stuck "researching" past the timeout (their request died
// mid-research). Under the attempts cap they go back to pending for another go;
// over it they're failed so a bad row can't loop the queue forever.
export async function reclaimStaleResearching(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - STALE_RESEARCHING_MS);
  const stale = await commandDb.prospectImportItem.findMany({
    where: { status: "researching", updatedAt: { lt: cutoff } },
    select: { id: true, attempts: true },
    take: 100,
  });
  for (const s of stale) {
    await commandDb.prospectImportItem.update({
      where: { id: s.id },
      data: s.attempts >= MAX_ATTEMPTS
        ? { status: "failed", error: "Timed out after several attempts." }
        : { status: "pending" },
    });
  }
}

// Atomically claim the next pending item (pending -> researching, +1 attempt).
// Returns null when nothing is claimable. The status-guarded updateMany makes the
// claim safe against a second worker grabbing the same row.
async function claimNextPending(batchId: string): Promise<{ id: string; inputAgency: string; inputLocation: string | null } | null> {
  for (let i = 0; i < 5; i++) {
    const item = await commandDb.prospectImportItem.findFirst({
      where: { batchId, status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { id: true, inputAgency: true, inputLocation: true },
    });
    if (!item) return null;
    const claimed = await commandDb.prospectImportItem.updateMany({
      where: { id: item.id, status: "pending" },
      data: { status: "researching", attempts: { increment: 1 } },
    });
    if (claimed.count === 1) return item;
  }
  return null;
}

// Mark the batch done once no work remains (nothing pending and nothing mid-flight).
async function finalizeIfDone(batchId: string): Promise<boolean> {
  const outstanding = await commandDb.prospectImportItem.count({ where: { batchId, status: { in: ["pending", "researching"] } } });
  if (outstanding === 0) {
    await commandDb.prospectImportBatch.update({ where: { id: batchId }, data: { status: "done" } });
    return true;
  }
  return false;
}

// Claim + process a single item. Returns whether an item was claimed (so a
// caller loop knows to keep going) and how many pending remain.
export async function processNextItem(batchId: string, createdById: string | null): Promise<{ claimed: boolean; remaining: number }> {
  await reclaimStaleResearching();
  const item = await claimNextPending(batchId);
  if (!item) {
    await finalizeIfDone(batchId);
    return { claimed: false, remaining: 0 };
  }

  let status = "imported";
  let prospectId: string | null = null;
  let error: string | null = null;
  try {
    const res = await importOne(item.inputAgency, item.inputLocation, createdById);
    status = res.status;
    prospectId = res.prospectId ?? null;
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message.slice(0, 200) : "Research failed.";
  }
  await commandDb.prospectImportItem.update({ where: { id: item.id }, data: { status, prospectId, error } });

  const remaining = await commandDb.prospectImportItem.count({ where: { batchId, status: "pending" } });
  await finalizeIfDone(batchId);
  return { claimed: true, remaining };
}

// Finish every still-processing batch server-side, within a wall-clock budget so
// the cron request stays within its function limit. Runs even if the operator's
// tab is closed, so a batch always completes.
export async function drainProcessingBatches(budgetMs = 240_000): Promise<{ batches: number; processed: number }> {
  const start = Date.now();
  await reclaimStaleResearching();
  const batches = await commandDb.prospectImportBatch.findMany({
    where: { status: "processing" },
    select: { id: true, createdById: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
  let processed = 0;
  for (const b of batches) {
    while (Date.now() - start < budgetMs) {
      const r = await processNextItem(b.id, b.createdById);
      if (!r.claimed) break;
      processed++;
    }
  }
  return { batches: batches.length, processed };
}
