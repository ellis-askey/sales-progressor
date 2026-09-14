// Build Order H launch orchestration. APPROVED != SEND: an approved experiment is
// inert until a superadmin deliberately launches it. This module owns eligibility
// resolution, deterministic cohort/allocation, content-hash verification, the
// atomic launch lock, assignment + frozen-flow creation, the OutreachLaunch audit,
// and the batched, business-hours-gated, capped, resumable send processor.
//
// The AI model has zero control here. Nothing sends outside the Europe/London
// business window, even on a deliberate human Launch.

import { createHash } from "crypto";
import { commandDb } from "@/lib/command/prisma";
import { contentHash, type ApprovalSnapshot } from "./approval";
import { segmentValue, type SegmentDimension } from "./segments";
import { aiOutreachSender, isWithinBusinessHours, scheduleForBusinessHours, OUTREACH_SEND_LIMITS } from "./send-limits";
import { sendExperimentStep, recoverStaleSending, type SendTransport, type StepSendOutcome } from "./experiment-send";

const STATUS_ELIGIBLE = new Set(["new", "contacted"]);
const EXCLUSION_KEYS = ["opted_out", "bounced", "converted", "archived", "no_email", "active_flow", "other_running_experiment", "status_excluded"] as const;
type ExclusionKey = (typeof EXCLUSION_KEYS)[number];

type Target = { kind: "all_eligible" } | { kind: "segment"; dimension: SegmentDimension; values: string[] };
type SegFilter = { dimension: SegmentDimension; values: string[] };

// ── Content integrity ────────────────────────────────────────────────────────

type ExperimentWithVariants = {
  approvedSnapshot: unknown;
  contentHash: string | null;
  targetSegment: unknown;
  exclusions: unknown;
  allocationPct: number | null;
  primaryMetric: string | null;
  secondaryMetrics: unknown;
  variants: { role: string; emails: unknown }[];
};

export function verifyContentIntegrity(exp: ExperimentWithVariants): { ok: boolean; reason?: string } {
  if (!exp.approvedSnapshot || !exp.contentHash) return { ok: false, reason: "not approved / no snapshot" };
  const snap = exp.approvedSnapshot as ApprovalSnapshot;
  if (contentHash(snap) !== exp.contentHash) return { ok: false, reason: "approvedSnapshot hash does not match contentHash" };
  // Live content must still equal the approved snapshot.
  const live: ApprovalSnapshot = {
    control: exp.variants.find((v) => v.role === "control")?.emails ?? null,
    challenger: exp.variants.find((v) => v.role === "challenger")?.emails ?? null,
    targetSegment: exp.targetSegment,
    exclusions: exp.exclusions,
    allocationPct: exp.allocationPct,
    primaryMetric: exp.primaryMetric,
    secondaryMetrics: exp.secondaryMetrics,
  };
  if (contentHash(live) !== exp.contentHash) return { ok: false, reason: "live experiment content has drifted from the approved snapshot" };
  return { ok: true };
}

// ── Eligibility ──────────────────────────────────────────────────────────────

export type EligibilityRow = { id: string };
export type EligibilityResult = { eligible: EligibilityRow[]; exclusionCounts: Record<ExclusionKey, number>; targetMatched: number };

function matchesSeg(row: { source: string | null; groupId: string | null; followUpCount: number; lastContactedAt: Date | null; postcode: string | null }, f: SegFilter): boolean {
  return f.values.includes(segmentValue(f.dimension, row));
}

export async function resolveEligibility(experimentId: string, target: Target | null, exclusions: SegFilter[]): Promise<EligibilityResult> {
  const prospects = await commandDb.prospect.findMany({
    select: {
      id: true, status: true, optedOutAt: true, bouncedAt: true, convertedAgencyId: true, archivedAt: true, generalEmail: true,
      source: true, groupId: true, followUpCount: true, lastContactedAt: true, postcode: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { email: true } },
      flows: { where: { status: "active" }, select: { id: true } },
      outreachAssignments: { select: { experiment: { select: { status: true } } } },
    },
  });

  const counts: Record<ExclusionKey, number> = Object.fromEntries(EXCLUSION_KEYS.map((k) => [k, 0])) as Record<ExclusionKey, number>;
  const eligible: EligibilityRow[] = [];
  let targetMatched = 0;

  for (const p of prospects) {
    // Target audience membership (all_eligible = everyone; segment = filter).
    const inTarget = !target || target.kind === "all_eligible" || (target.kind === "segment" && matchesSeg(p, { dimension: target.dimension, values: target.values }));
    if (!inTarget) continue;
    if (exclusions.some((ex) => matchesSeg(p, ex))) continue; // targeting-level exclusion (not an audit "reason")
    targetMatched++;

    // First-hit exclusion reason (priority order).
    const hasEmail = !!(p.contacts.find((c) => c.email)?.email ?? p.generalEmail);
    let reason: ExclusionKey | null = null;
    if (p.optedOutAt) reason = "opted_out";
    else if (p.bouncedAt) reason = "bounced";
    else if (p.convertedAgencyId) reason = "converted";
    else if (p.archivedAt) reason = "archived";
    else if (!hasEmail) reason = "no_email";
    else if (p.flows.length > 0) reason = "active_flow";
    else if (p.outreachAssignments.some((a) => a.experiment.status === "running")) reason = "other_running_experiment";
    else if (!STATUS_ELIGIBLE.has(p.status)) reason = "status_excluded";

    if (reason) counts[reason]++;
    else eligible.push({ id: p.id });
  }
  return { eligible, exclusionCounts: counts, targetMatched };
}

// ── Deterministic cohort + allocation ────────────────────────────────────────

function hashOrder(experimentId: string, prospectId: string): string {
  return createHash("sha256").update(`${experimentId}:${prospectId}`).digest("hex");
}

export type Cohort = {
  actualSample: number;
  challengerCount: number;
  controlCount: number;
  challengerIds: string[];
  controlIds: string[];
};

export function selectCohort(experimentId: string, eligibleIds: string[], requestedSample: number, allocationPct: number): Cohort {
  const sorted = [...eligibleIds].sort((a, b) => (hashOrder(experimentId, a) < hashOrder(experimentId, b) ? -1 : 1));
  const actualSample = Math.max(0, Math.min(requestedSample, sorted.length));
  const cohort = sorted.slice(0, actualSample);
  // round-half-up: the unavoidable remainder goes to the challenger.
  const challengerCount = Math.floor((actualSample * allocationPct) / 100 + 0.5);
  const controlCount = actualSample - challengerCount;
  return {
    actualSample,
    challengerCount,
    controlCount,
    challengerIds: cohort.slice(0, challengerCount),
    controlIds: cohort.slice(challengerCount),
  };
}

// ── Preflight (read-only, no external effect, no writes) ─────────────────────

function parseTarget(v: unknown): Target | null {
  if (v && typeof v === "object" && "kind" in v) {
    const t = v as Target;
    if (t.kind === "all_eligible") return { kind: "all_eligible" };
    if (t.kind === "segment") return { kind: "segment", dimension: t.dimension, values: t.values };
  }
  return null;
}
function parseExclusions(v: unknown): SegFilter[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object" && "dimension" in x && "values" in x) as SegFilter[]) : [];
}

export type Preflight = {
  experimentId: string;
  title: string;
  status: string;
  reviewOutcome: string | null;
  reviewerOverridden: boolean;
  editedAfterReview: boolean;
  requestedSample: number;
  eligibleCount: number;
  actualSample: number;
  challengerCount: number;
  controlCount: number;
  allocationPct: number;
  exclusionCounts: Record<string, number>;
  senderConfigured: boolean;
  withinBusinessHours: boolean;
  sendingBeginsAt: string | null; // ISO, when outside hours
  underSample: boolean;
  blockers: string[];
};

async function loadExperiment(experimentId: string) {
  return commandDb.outreachExperiment.findUnique({
    where: { id: experimentId },
    select: {
      id: true, title: true, status: true, reviewOutcome: true, reviewerOverriddenAt: true, editedAfterReview: true,
      sampleSize: true, allocationPct: true, targetSegment: true, exclusions: true, approvedSnapshot: true,
      contentHash: true, primaryMetric: true, secondaryMetrics: true,
      variants: { select: { role: true, emails: true } },
      launch: { select: { id: true } },
    },
  });
}

export async function preflightExperiment(experimentId: string, now: Date = new Date()): Promise<Preflight | { error: string }> {
  const exp = await loadExperiment(experimentId);
  if (!exp) return { error: "Experiment not found." };

  const blockers: string[] = [];
  if (exp.status !== "approved") blockers.push(`Experiment is "${exp.status}", not approved.`);
  if (exp.launch) blockers.push("This experiment has already been launched.");
  const integrity = verifyContentIntegrity(exp);
  if (!integrity.ok) blockers.push(`Content integrity: ${integrity.reason}.`);
  const senderConfigured = !!aiOutreachSender();
  if (!senderConfigured) blockers.push("AI_OUTREACH_FROM_EMAIL is not set or invalid.");

  const target = parseTarget(exp.targetSegment);
  const exclusions = parseExclusions(exp.exclusions);
  const { eligible, exclusionCounts } = await resolveEligibility(experimentId, target, exclusions);
  const requestedSample = exp.sampleSize ?? 0;
  const allocationPct = exp.allocationPct ?? 50;
  const cohort = selectCohort(experimentId, eligible.map((e) => e.id), requestedSample, allocationPct);
  if (eligible.length === 0) blockers.push("Zero eligible prospects.");

  const within = isWithinBusinessHours(now);

  return {
    experimentId: exp.id,
    title: exp.title,
    status: exp.status,
    reviewOutcome: exp.reviewOutcome,
    reviewerOverridden: !!exp.reviewerOverriddenAt,
    editedAfterReview: exp.editedAfterReview,
    requestedSample,
    eligibleCount: eligible.length,
    actualSample: cohort.actualSample,
    challengerCount: cohort.challengerCount,
    controlCount: cohort.controlCount,
    allocationPct,
    exclusionCounts,
    senderConfigured,
    withinBusinessHours: within,
    sendingBeginsAt: within ? null : scheduleForBusinessHours(now).toISOString(),
    underSample: eligible.length > 0 && eligible.length < requestedSample,
    blockers,
  };
}

// ── Launch ───────────────────────────────────────────────────────────────────

export type LaunchResult =
  | { ok: true; launched: true; actualSample: number; assignedControl: number; assignedChallenger: number; initial: SendTally }
  | { ok: false; needsUnderSampleConfirm: true; eligibleCount: number; requestedSample: number }
  | { ok: false; error: string };

export type SendTally = { accepted: number; failed: number; uncertain: number; suppressed: number; pending: number; sentThisRun: number; withinHours: boolean };

function frozenStepsFor(role: "control" | "challenger", snap: ApprovalSnapshot): { stepIndex: number; templateKey: string; subject: string; body: string; gapDays: number }[] {
  const raw = (role === "control" ? snap.control : snap.challenger) as { stepIndex?: number; templateKey?: string; subject?: string; body?: string; gapDays?: number }[];
  return (raw ?? []).map((s, i) => ({
    stepIndex: s.stepIndex ?? i,
    templateKey: s.templateKey ?? `${role}_${i}`,
    subject: s.subject ?? "",
    body: s.body ?? "",
    gapDays: s.gapDays ?? 0,
  }));
}

export async function launchExperiment(params: {
  experimentId: string;
  actorUserId: string | null;
  confirmUnderSample?: boolean;
  transport?: SendTransport;
  now?: Date;
}): Promise<LaunchResult> {
  const now = params.now ?? new Date();
  const exp = await loadExperiment(params.experimentId);
  if (!exp) return { ok: false, error: "Experiment not found." };
  if (exp.status !== "approved") return { ok: false, error: `Experiment is "${exp.status}", not approved.` };
  if (exp.launch) return { ok: false, error: "This experiment has already been launched." };

  const integrity = verifyContentIntegrity(exp);
  if (!integrity.ok) return { ok: false, error: `Content integrity check failed: ${integrity.reason}. Launch refused.` };
  if (!aiOutreachSender()) return { ok: false, error: "AI_OUTREACH_FROM_EMAIL is not set or invalid; launch blocked." };

  const target = parseTarget(exp.targetSegment);
  const exclusions = parseExclusions(exp.exclusions);
  const { eligible, exclusionCounts } = await resolveEligibility(params.experimentId, target, exclusions);
  const requestedSample = exp.sampleSize ?? 0;
  const allocationPct = exp.allocationPct ?? 50;
  if (eligible.length === 0) return { ok: false, error: "Zero eligible prospects; launch blocked." };
  if (eligible.length < requestedSample && !params.confirmUnderSample) {
    return { ok: false, needsUnderSampleConfirm: true, eligibleCount: eligible.length, requestedSample };
  }

  const cohort = selectCohort(params.experimentId, eligible.map((e) => e.id), requestedSample, allocationPct);
  const snap = exp.approvedSnapshot as ApprovalSnapshot;

  // Atomic launch lock: only one caller flips approved -> running.
  const lock = await commandDb.outreachExperiment.updateMany({
    where: { id: params.experimentId, status: "approved" },
    data: { status: "running", launchedById: params.actorUserId, launchedAt: now },
  });
  if (lock.count === 0) return { ok: false, error: "Launch already in progress or completed (lost the lock)." };

  // OutreachLaunch audit (experimentId @unique => the hard one-launch invariant).
  try {
    await commandDb.outreachLaunch.create({
      data: {
        experimentId: params.experimentId,
        launchedById: params.actorUserId,
        launchedAt: now,
        contentHash: exp.contentHash!,
        requestedSample,
        eligibleCount: eligible.length,
        actualSample: cohort.actualSample,
        assignedControl: cohort.controlCount,
        assignedChallenger: cohort.challengerCount,
        exclusionCounts,
        status: "armed",
      },
    });
  } catch {
    return { ok: false, error: "A launch record already exists for this experiment." };
  }

  // Freeze the cohort: assignments (idempotent on unique) + one experiment flow per
  // prospect carrying the FROZEN variant content (from approvedSnapshot, never the
  // live variants or DEFAULT_SEQUENCE). Step 0 due now; later steps null.
  const controlIds = new Set(cohort.controlIds);
  const byVariant: Record<"control" | "challenger", string[]> = { control: cohort.controlIds, challenger: cohort.challengerIds };
  const variantRows = await commandDb.outreachVariant.findMany({ where: { experimentId: params.experimentId }, select: { id: true, role: true } });
  const variantId = (role: "control" | "challenger") => variantRows.find((v) => v.role === role)?.id ?? null;

  const contactByProspect = await commandDb.prospectContact.findMany({
    where: { prospectId: { in: cohort.controlIds.concat(cohort.challengerIds) } },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { id: true, prospectId: true, email: true },
  });
  const generalEmails = await commandDb.prospect.findMany({ where: { id: { in: cohort.controlIds.concat(cohort.challengerIds) } }, select: { id: true, generalEmail: true } });
  const genMap = new Map(generalEmails.map((g) => [g.id, g.generalEmail]));
  const contactMap = new Map<string, { id: string; email: string | null }>();
  for (const c of contactByProspect) if (c.prospectId && !contactMap.has(c.prospectId)) contactMap.set(c.prospectId, { id: c.id, email: c.email });

  for (const [role, ids] of Object.entries(byVariant) as ["control" | "challenger", string[]][]) {
    const steps = frozenStepsFor(role, snap);
    for (const prospectId of ids) {
      const contact = contactMap.get(prospectId);
      const to = contact?.email ?? genMap.get(prospectId) ?? null;
      // idempotency: skip if a flow already exists for this experiment+prospect
      const already = await commandDb.prospectFlow.findFirst({ where: { experimentId: params.experimentId, prospectId }, select: { id: true } });
      if (already) continue;
      await commandDb.outreachAssignment.upsert({
        where: { experimentId_prospectId: { experimentId: params.experimentId, prospectId } },
        create: { experimentId: params.experimentId, prospectId, variantId: variantId(role)! },
        update: {},
      });
      await commandDb.prospectFlow.create({
        data: {
          prospectId,
          experimentId: params.experimentId,
          variantId: variantId(role),
          startedById: params.actorUserId,
          steps: {
            // Step 0 is due now (queued); later steps are "scheduled" (null until the
            // previous one sends) so advanceFlowAfterSend schedules them. They already
            // carry the FROZEN content, so nothing is re-drafted at send time.
            create: steps.map((s, i) => ({
              stepIndex: s.stepIndex,
              templateKey: s.templateKey,
              status: i === 0 ? "queued" : "scheduled",
              contactId: contact?.id ?? null,
              toEmail: to,
              subject: s.subject,
              body: s.body,
              scheduledFor: i === 0 ? now : null,
            })),
          },
        },
      });
    }
  }
  void controlIds;

  // Process the initial (step-0) sends: batched, business-hours-gated, capped.
  const initial = await processExperimentSends({ experimentId: params.experimentId, transport: params.transport, now });
  await refreshLaunchTally(params.experimentId, now);

  return {
    ok: true,
    launched: true,
    actualSample: cohort.actualSample,
    assignedControl: cohort.controlCount,
    assignedChallenger: cohort.challengerCount,
    initial,
  };
}

// ── Batched send processor (initial + follow-ups) ────────────────────────────

function startOfLondonDay(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const londonWallAsUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const offset = londonWallAsUTC - now.getTime();
  const midnightWallAsUTC = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0);
  return new Date(midnightWallAsUTC - offset);
}

async function dailyAcceptedCount(now: Date): Promise<number> {
  return commandDb.prospectEmail.count({
    where: { experimentId: { not: null }, sendState: "accepted", acceptedAt: { gte: startOfLondonDay(now) } },
  });
}

// Recovery sweep, business-hours gate, daily + per-run caps, then send due steps.
export async function processExperimentSends(params: { experimentId?: string; transport?: SendTransport; now?: Date; perRunCap?: number }): Promise<SendTally> {
  const now = params.now ?? new Date();
  await recoverStaleSending(now);

  const empty: SendTally = { accepted: 0, failed: 0, uncertain: 0, suppressed: 0, pending: 0, sentThisRun: 0, withinHours: isWithinBusinessHours(now) };
  if (!isWithinBusinessHours(now)) return empty; // outside window: send nothing, leave pending

  const dailyRemaining = OUTREACH_SEND_LIMITS.EXPERIMENT_DAILY_CAP - (await dailyAcceptedCount(now));
  if (dailyRemaining <= 0) return empty;

  const perRunCap = params.perRunCap ?? OUTREACH_SEND_LIMITS.LAUNCH_PER_RUN_CAP;
  const batchLimit = Math.min(OUTREACH_SEND_LIMITS.INITIAL_SEND_BATCH, perRunCap, dailyRemaining);

  const due = await commandDb.prospectFlowStep.findMany({
    where: {
      status: { in: ["queued", "scheduled"] },
      scheduledFor: { lte: now },
      flow: { status: "active", experimentId: params.experimentId ?? { not: null } },
    },
    orderBy: [{ flowId: "asc" }, { stepIndex: "asc" }],
    take: batchLimit,
    select: { id: true },
  });

  const tally: SendTally = { accepted: 0, failed: 0, uncertain: 0, suppressed: 0, pending: 0, sentThisRun: 0, withinHours: true };
  let sent = 0;
  for (const s of due) {
    if (sent >= perRunCap || sent >= dailyRemaining) break;
    const outcome: StepSendOutcome = await sendExperimentStep({ stepId: s.id, transport: params.transport, now });
    if (outcome === "accepted") { tally.accepted++; sent++; }
    else if (outcome === "failed_before_acceptance") tally.failed++;
    else if (outcome === "skipped_suppressed") tally.suppressed++;
  }
  tally.sentThisRun = sent;
  return tally;
}

// ── Resume (retry only known-not-accepted; never uncertain) ──────────────────

export async function resumeLaunch(params: { experimentId: string; transport?: SendTransport; now?: Date }): Promise<SendTally> {
  const now = params.now ?? new Date();
  await recoverStaleSending(now);
  // failed_before_acceptance rows: flip their step back to queued so the processor
  // retries them (pending steps are already queued). Uncertain/accepted untouched.
  const retryable = await commandDb.prospectEmail.findMany({
    where: { experimentId: params.experimentId, sendState: "failed_before_acceptance" },
    select: { sendDedupeKey: true },
  });
  void retryable; // steps for failed sends are still "queued" (we never marked them sent), so the processor picks them up
  const tally = await processExperimentSends({ experimentId: params.experimentId, transport: params.transport, now });
  await refreshLaunchTally(params.experimentId, now);
  return tally;
}

// Recompute the OutreachLaunch tallies from ProspectEmail states (truthful,
// idempotent) and set its status.
export async function refreshLaunchTally(experimentId: string, now: Date = new Date()): Promise<void> {
  const emails = await commandDb.prospectEmail.groupBy({
    by: ["sendState"],
    where: { experimentId },
    _count: { _all: true },
  });
  const count = (s: string) => emails.find((e) => e.sendState === s)?._count._all ?? 0;
  const accepted = count("accepted");
  const failed = count("failed_before_acceptance");
  const uncertain = count("uncertain");
  const suppressed = count("skipped_suppressed");
  // pending step-0s still to send:
  const pendingSteps = await commandDb.prospectFlowStep.count({
    where: { status: "queued", flow: { experimentId, status: "active" } },
  });
  const status = pendingSteps > 0 ? "sending" : failed > 0 || uncertain > 0 ? "partially_failed" : "completed";
  await commandDb.outreachLaunch.update({
    where: { experimentId },
    data: { initialSent: accepted, initialFailed: failed, initialUncertain: uncertain, initialSuppressed: suppressed, status, finishedAt: status === "completed" ? now : null },
  });
}
