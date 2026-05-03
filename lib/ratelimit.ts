import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = { success: boolean; reset: number; remaining: number };

// Pass-through result — used whenever rate limiting is disabled or unconfigured.
// No in-memory fallback: serverless functions share no state between invocations.
const PASS: RateLimitResult = { success: true, reset: 0, remaining: 999 };

/**
 * Returns true only when BOTH conditions hold:
 *   1. RATE_LIMIT_ENABLED=true  (explicit opt-in — default is off)
 *   2. UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set
 *
 * If either is missing the entire module is a no-op. Deployments without
 * Upstash credentials are safe without any special-casing in callers.
 */
function isEnabled(): boolean {
  return (
    process.env.RATE_LIMIT_ENABLED === "true" &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// ── Rate limiters ─────────────────────────────────────────────────────────────

/**
 * Auth login: 5 attempts per 15-minute sliding window — keyed by IP.
 * Applied inside NextAuth credentials authorize() and /api/auth/forgot-password.
 */
export async function checkAuthLimit(ip: string): Promise<RateLimitResult> {
  if (!isEnabled()) return PASS;
  const rl = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "rl:auth",
  });
  const { success, reset, remaining } = await rl.limit(ip);
  return { success, reset, remaining };
}

/**
 * Signup: 10 registrations per hour — keyed by IP.
 * Prevents account farming and invite flooding via the public /api/register endpoint.
 */
export async function checkSignupLimit(ip: string): Promise<RateLimitResult> {
  if (!isEnabled()) return PASS;
  const rl = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "60 m"),
    prefix: "rl:signup",
  });
  const { success, reset, remaining } = await rl.limit(ip);
  return { success, reset, remaining };
}

/**
 * AI generation: 30/hour AND 200/day — keyed by user ID.
 * Applied to /api/ai/generate-chase and any other AI inference endpoints.
 */
export async function checkAiLimit(userId: string): Promise<RateLimitResult> {
  if (!isEnabled()) return PASS;
  const redis = getRedis();
  const [hourly, daily] = await Promise.all([
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60 m"), prefix: "rl:ai:h" }).limit(userId),
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, "24 h"), prefix: "rl:ai:d" }).limit(userId),
  ]);
  if (!hourly.success) return { success: false, reset: hourly.reset, remaining: 0 };
  if (!daily.success)  return { success: false, reset: daily.reset,  remaining: 0 };
  return { success: true, reset: 0, remaining: Math.min(hourly.remaining, daily.remaining) };
}

/**
 * Email send: 50/hour — keyed by user ID.
 * Applied to /api/chase/send-email.
 */
export async function checkEmailLimit(userId: string): Promise<RateLimitResult> {
  if (!isEnabled()) return PASS;
  const rl = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(50, "60 m"),
    prefix: "rl:email",
  });
  const { success, reset, remaining } = await rl.limit(userId);
  return { success, reset, remaining };
}

/**
 * Portal action: 60 per 15 minutes — keyed by portal token (first 32 chars).
 * Applied to high-risk portal endpoints: invite (sends email) and document upload.
 */
export async function checkPortalLimit(token: string): Promise<RateLimitResult> {
  if (!isEnabled()) return PASS;
  const rl = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, "15 m"),
    prefix: "rl:portal",
  });
  const { success, reset, remaining } = await rl.limit(token.slice(0, 32));
  return { success, reset, remaining };
}

// ── Response helper ───────────────────────────────────────────────────────────

export function rateLimitJson(result: RateLimitResult): {
  error: string;
  message: string;
  retryAfter: number;
} {
  const retryAfter = Math.ceil(Math.max(0, result.reset - Date.now()) / 1000);
  const minutes = Math.ceil(retryAfter / 60) || 15;
  return {
    error: "rate_limited",
    message: `Too many requests. Please wait ${minutes} minute${minutes !== 1 ? "s" : ""} before trying again.`,
    retryAfter,
  };
}
