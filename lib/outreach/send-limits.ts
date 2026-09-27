// Application-owned send limits + business-hours gate for the AI outreach engine
// (Build Order H). Deliberately conservative V1 values (fresh sending domain).
// These are constants, NEVER model-controlled, and structured so they can be
// raised later without redesigning the engine.

export const OUTREACH_SEND_LIMITS = {
  INITIAL_SEND_BATCH: 25, // step-0 sends processed per pass
  LAUNCH_PER_RUN_CAP: 100, // max step-0 sends a single Launch/Resume run processes
  EXPERIMENT_DAILY_CAP: 50, // absolute per-day ceiling; the warm-up ramp keeps the effective cap below this early on
  CRON_PER_RUN_CAP: 5, // sends per recurring-cron tick — spaces sends out instead of bursting
  FOLLOWUP_SEND_BATCH: 25, // follow-up sends processed per tick pass
  BUSINESS_OPEN_HOUR: 8, // Europe/London
  BUSINESS_CLOSE_HOUR: 19,
  UNCERTAIN_THRESHOLD_MS: 120_000, // a `sending` row older than this becomes `uncertain`
} as const;

// Warm-up ramp for a fresh sending domain: daily volume climbs with the domain's
// sending age (days since the first accepted outreach send) rather than starting
// flat, which reads as a spam cannon to mailbox providers. Steady state never
// exceeds EXPERIMENT_DAILY_CAP.
export const OUTREACH_WARMUP_TIERS = [
  { untilDay: 7, cap: 8 },
  { untilDay: 14, cap: 15 },
  { untilDay: 21, cap: 22 },
] as const;
export const OUTREACH_WARMUP_STEADY_CAP = 30;

export function warmupDailyCap(sendingAgeDays: number): number {
  const age = Number.isFinite(sendingAgeDays) && sendingAgeDays > 0 ? sendingAgeDays : 0;
  const tier = OUTREACH_WARMUP_TIERS.find((t) => age < t.untilDay);
  const cap = tier ? tier.cap : OUTREACH_WARMUP_STEADY_CAP;
  return Math.min(cap, OUTREACH_SEND_LIMITS.EXPERIMENT_DAILY_CAP);
}

// The AI outreach identity. Experiment sends MUST use this. There is NO fallback
// to the manual PROSPECT_FROM_EMAIL / ellis@ identity.
export function aiOutreachSender(): { email: string; name: string } | null {
  const email = process.env.AI_OUTREACH_FROM_EMAIL?.trim();
  const name = process.env.AI_OUTREACH_FROM_NAME?.trim() || "The Sales Progressor";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null; // absent/invalid -> hard block upstream
  return { email, name };
}

// Europe/London business window: Mon-Fri 08:00-19:00. Both initial and follow-up
// experiment sends respect this. A human Launch authorises the campaign but never
// overrides the window.
export function isWithinBusinessHours(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const hour = parseInt(hourStr, 10) % 24;
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  return isWeekday && hour >= OUTREACH_SEND_LIMITS.BUSINESS_OPEN_HOUR && hour < OUTREACH_SEND_LIMITS.BUSINESS_CLOSE_HOUR;
}

// Next moment sending is permitted, for the UI ("sending can begin ..."). Reuses
// the existing business-hours scheduler for consistency with the rest of the app.
export { scheduleForBusinessHours } from "@/lib/email/outboundQueue";
