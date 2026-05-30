"use server";

// AI-generated property-file summary, ellis-only prototype.
//
// Build context → strict PII redaction → Anthropic Haiku 4.5 → JSON schema
// matching the SummaryJson type below. No caching, no DB writes. console.log
// surfaces token counts + cost estimate so we can spot-check spend.
//
// PII rules match the existing chase-generation pattern at
// app/api/ai/generate-chase/route.ts:168-175 — see the helpers at the top
// of this file. If this prototype graduates beyond ellis-only, the redaction
// pass needs hardening (LLM-side post-check at minimum).

import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getTransactionByScope } from "@/lib/services/transactions";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { getReminderLogsForTransaction } from "@/lib/services/reminders";
import { getActivityTimeline } from "@/lib/services/comms";
import { listManualTasksForTransaction } from "@/lib/services/manual-tasks";
import { anthropic } from "@/lib/anthropic";

const ALLOWED_EMAILS = new Set(["ellis@thesalesprogressor.co.uk"]);
const MODEL = "claude-haiku-4-5-20251001";

export type SummaryJson = {
  status: string;
  keyDates: Array<{ label: string; date: string; note?: string }>;
  whereItsStuck: string;
  recentActivity: string;
  watchOutFor: string;
};

export async function generateTransactionSummaryAction(transactionId: string):
  Promise<{ ok: true; summary: SummaryJson } | { ok: false; error: string }> {
  const session = await requireSession();

  if (!ALLOWED_EMAILS.has(session.user.email ?? "")) {
    return { ok: false, error: "Forbidden" };
  }

  const scope = getAccessScope(session);

  // Fetch everything in parallel. All five helpers are already-existing
  // queries used by the transaction detail page.
  const [transaction, milestoneData, reminderLogs, activityEntries, manualTasks] = await Promise.all([
    getTransactionByScope(transactionId, scope),
    getMilestonesForTransaction(transactionId, null).catch(() => null),
    getReminderLogsForTransaction(transactionId, null).catch(() => []),
    getActivityTimeline(transactionId, null).catch(() => []),
    listManualTasksForTransaction(transactionId, null).catch(() => []),
  ]);

  if (!transaction) return { ok: false, error: "Transaction not found" };

  // ── Build the list of contact first names for redaction. We pass this to
  // the string sanitiser so any free-text field containing them is censored.
  const contactFirstNames = transaction.contacts
    .map((c) => firstNameOf(c.name))
    .filter((n) => n.length > 1);

  // ── Redacted context object — only this object goes to Anthropic.
  const context = {
    property: {
      address: shortenAddress(transaction.propertyAddress),
      tenure: transaction.tenure,
      purchaseType: transaction.purchaseType,
      isShareOfFreehold: transaction.isShareOfFreehold,
      serviceType: transaction.serviceType,
      purchasePricePence: transaction.purchasePrice,
      status: transaction.status,
      agencyName: transaction.agency.name,
    },
    dates: {
      createdAt: transaction.createdAt.toISOString().slice(0, 10),
      expectedExchangeDate: transaction.expectedExchangeDate?.toISOString().slice(0, 10) ?? null,
      completionDate: transaction.completionDate?.toISOString().slice(0, 10) ?? null,
      holdPeriods: transaction.holdPeriods.map((h) => ({
        startedAt: h.startedAt.toISOString().slice(0, 10),
        endedAt: h.endedAt?.toISOString().slice(0, 10) ?? null,
      })),
      daysElapsed: Math.floor((Date.now() - transaction.createdAt.getTime()) / 86400000),
    },
    parties: {
      contactsByRole: countByRole(transaction.contacts),
      hasVendorSolicitor: !!transaction.vendorSolicitorContactId,
      hasPurchaserSolicitor: !!transaction.purchaserSolicitorContactId,
      hasBroker: !!transaction.brokerContactId,
      progressedBy: transaction.progressedBy,
    },
    milestones: milestoneData
      ? [...milestoneData.vendor, ...milestoneData.purchaser]
          .map((m) => ({
            side: m.side,
            code: m.code,
            name: m.name,
            state: m.isComplete ? "complete" : m.isNotRequired ? "not_required" : m.completion?.state ?? "unknown",
            completedAt: m.completion?.completedAt?.toISOString().slice(0, 10) ?? null,
            eventDate: m.completion?.eventDate?.toISOString().slice(0, 10) ?? null,
            confirmedByPortal: m.completion?.confirmedByPortal ?? false,
          }))
      : [],
    reminders: reminderLogs.map((l) => ({
      ruleName: l.reminderRule.name,
      targetMilestoneCode: l.reminderRule.targetMilestoneCode,
      status: l.status,
      snoozedUntil: l.snoozedUntil?.toISOString().slice(0, 10) ?? null,
      nextDueDate: l.nextDueDate.toISOString().slice(0, 10),
      chaseCount: l.chaseTasks[0]?.chaseCount ?? 0,
      priority: l.chaseTasks[0]?.priority ?? "normal",
    })),
    manualTasks: manualTasks.map((t) => ({
      title: redact(t.title, contactFirstNames),
      status: t.status,
      dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
    })),
    activityRecent: activityEntries
      .slice(0, 30)
      .map((e) => {
        if (e.kind === "milestone") {
          return {
            kind: "milestone" as const,
            at: e.at?.toISOString().slice(0, 10) ?? null,
            milestoneCode: e.milestoneCode,
            milestoneName: e.milestoneName,
            isNotRequired: e.isNotRequired,
            confirmedByClient: e.confirmedByClient,
          };
        }
        // Comm entry — withhold content if it names any contact, otherwise redact.
        const namesPresent = e.contactNames.length > 0;
        const safeContent = namesPresent
          ? "[contained contact name — content withheld]"
          : redact(e.content, contactFirstNames);
        return {
          kind: "comm" as const,
          at: e.at.toISOString().slice(0, 10),
          type: e.type,
          method: e.method,
          visibleToClient: e.visibleToClient,
          wasAiGenerated: e.wasAiGenerated,
          content: safeContent.length > 400 ? safeContent.slice(0, 400) + "…" : safeContent,
        };
      }),
  };

  const userMessage = JSON.stringify(context, null, 2);

  let msg;
  try {
    msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    console.error("[transaction-summary] anthropic call failed", err);
    return { ok: false, error: "Couldn't reach the AI service. Try again in a moment." };
  }

  const block = msg.content[0];
  if (block.type !== "text") {
    return { ok: false, error: "Unexpected response shape from the AI service." };
  }

  // Token + cost log — Haiku 4.5 pricing as of the prompt cutoff:
  // input ≈ $0.80/1M, output ≈ $4/1M. Real-time pricing may drift; this is a
  // gut-check, not an audit trail.
  const inTok = msg.usage.input_tokens;
  const outTok = msg.usage.output_tokens;
  const cost = (inTok / 1_000_000) * 0.80 + (outTok / 1_000_000) * 4.00;
  console.log(
    `[transaction-summary] tx=${transactionId} in=${inTok} out=${outTok} cost≈$${cost.toFixed(5)}`,
  );

  let parsed: SummaryJson;
  try {
    parsed = JSON.parse(stripJsonFence(block.text));
  } catch {
    return { ok: false, error: "Couldn't parse summary, try again." };
  }

  if (!validShape(parsed)) {
    return { ok: false, error: "Summary shape was invalid, try again." };
  }

  return { ok: true, summary: parsed };
}

// ── PII redaction helpers ─────────────────────────────────────────────────

// Strip postcode + town. Keep street line only. Lifted from
// app/api/ai/generate-chase/route.ts:168-175 — duplicated here rather than
// extracted to avoid touching the existing chase flow on a prototype.
function shortenAddress(full: string): string {
  const parts = full.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return full;
  const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
  const hasPostcode = POSTCODE_RE.test(parts[parts.length - 1]);
  if (hasPostcode && parts.length >= 3) return parts.slice(0, -2).join(", ");
  return parts.slice(0, -1).join(", ");
}

function firstNameOf(fullName: string): string {
  return (fullName.trim().split(/\s+/)[0] ?? "").trim();
}

// Replace any of the supplied first names with "[redacted]" (whole-word, case-
// insensitive). False-negative-prone — a name like "Will" or "Mark" gets
// scrubbed everywhere. The prompt instructs Claude to use role labels only,
// which is the primary defence; this is belt-and-braces.
function redact(input: string, firstNames: string[]): string {
  if (!input) return input;
  let out = input;
  for (const n of firstNames) {
    if (n.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegex(n)}\\b`, "gi");
    out = out.replace(re, "[redacted]");
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countByRole(contacts: { roleType: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of contacts) {
    out[c.roleType] = (out[c.roleType] ?? 0) + 1;
  }
  return out;
}

// Strip a ```json … ``` fence if Claude wrapped the output despite the
// instruction not to.
function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function validShape(x: unknown): x is SummaryJson {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.status === "string" &&
    Array.isArray(o.keyDates) &&
    typeof o.whereItsStuck === "string" &&
    typeof o.recentActivity === "string" &&
    typeof o.watchOutFor === "string"
  );
}

const SYSTEM_PROMPT = `You are an internal summariser for a UK estate-agency sales-progression platform.
You receive a JSON object describing a property transaction file with PII already redacted.

Your job: return a concise JSON summary helping the platform owner see at a glance
what's happening on this file without scanning the whole thing.

OUTPUT FORMAT
Return STRICT JSON only — no markdown, no commentary, no code fence.
Schema:
{
  "status": "1-2 sentences describing where the file is right now",
  "keyDates": [
    { "label": "Created" | "Expected exchange" | "Completion" | "Hold" | "Last activity" | other, "date": "YYYY-MM-DD" or human format, "note": "optional one-liner" }
  ],
  "whereItsStuck": "2-3 sentences on blockers, escalations, overdue chases",
  "recentActivity": "2-3 sentences on the last ~2 weeks",
  "watchOutFor": "1-2 sentences on what to keep an eye on next"
}

RULES
- Refer to parties by role only ("the vendor", "the purchaser's solicitor", "the broker"). Never invent names.
- Be specific about milestones by name when relevant (e.g. "Searches received").
- Flag any reminder that's been chased 2+ times.
- Note if any non-N/R milestone has been waiting >2 weeks since the previous step.
- Stay under 600 words total across all fields.
- If a field has nothing useful to say, return a single short sentence saying so — do not invent content.
- Do not include URLs, email-style placeholders, or contact identifiers.
- Return ONLY the JSON object, nothing before or after.`;
