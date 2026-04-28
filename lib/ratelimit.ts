import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = { success: boolean; reset: number; remaining: number };

function isConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// Auth: 5 attempts per 15-minute sliding window — by IP
export async function checkAuthLimit(ip: string): Promise<RateLimitResult> {
  if (!isConfigured()) return { success: true, reset: 0, remaining: 5 };
  const rl = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "rl:auth",
  });
  const { success, reset, remaining } = await rl.limit(ip);
  return { success, reset, remaining };
}

// AI generation: 30/hour AND 200/day — by user ID
export async function checkAiLimit(userId: string): Promise<RateLimitResult> {
  if (!isConfigured()) return { success: true, reset: 0, remaining: 30 };
  const redis = getRedis();
  const [hourly, daily] = await Promise.all([
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60 m"), prefix: "rl:ai:h" }).limit(userId),
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, "24 h"), prefix: "rl:ai:d" }).limit(userId),
  ]);
  if (!hourly.success) return { success: false, reset: hourly.reset, remaining: 0 };
  if (!daily.success) return { success: false, reset: daily.reset, remaining: 0 };
  return { success: true, reset: 0, remaining: Math.min(hourly.remaining, daily.remaining) };
}

// Email send: 50/hour — by user ID
export async function checkEmailLimit(userId: string): Promise<RateLimitResult> {
  if (!isConfigured()) return { success: true, reset: 0, remaining: 50 };
  const rl = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(50, "60 m"),
    prefix: "rl:email",
  });
  const { success, reset, remaining } = await rl.limit(userId);
  return { success, reset, remaining };
}

export function rateLimitJson(result: RateLimitResult): { error: string; message: string; retryAfter: number } {
  const retryAfter = Math.ceil(Math.max(0, result.reset - Date.now()) / 1000);
  const minutes = Math.ceil(retryAfter / 60) || 15;
  return {
    error: "rate_limited",
    message: `Too many requests. Please wait ${minutes} minute${minutes !== 1 ? "s" : ""} before trying again.`,
    retryAfter,
  };
}
