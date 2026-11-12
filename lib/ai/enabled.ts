// AI master switch (#291).
//
// One global toggle decides whether every AI-powered feature runs. When it's
// off, the product runs on deterministic code and wiring alone: AI calls
// short-circuit server-side (defence in depth at the model-client roots, the
// API routes and the crons) and the UI triggers are hidden.
//
// Source of truth: the SystemSetting singleton row, flipped from the Command
// Centre settings page. An env override AI_GLOBAL_DISABLE=true is a hard
// break-glass that wins over the stored value (for an instant kill without DB
// access). Default is ON, so a missing row / unreachable read never silently
// disables AI.

import { prisma } from "@/lib/prisma";

// Small in-process cache so hot paths (every chase draft, every cron tick) don't
// hit the DB each time. A flip propagates within the TTL across warm lambdas.
let cache: { value: boolean; at: number } | null = null;
const TTL_MS = 10_000;

function envForcesOff(): boolean {
  return process.env.AI_GLOBAL_DISABLE === "true";
}

/** True when AI features may run. Default ON; env break-glass forces OFF. */
export async function aiEnabled(): Promise<boolean> {
  if (envForcesOff()) return false;
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;
  let value = true;
  try {
    const row = await prisma.systemSetting.findUnique({ where: { id: "singleton" } });
    value = row?.aiEnabled ?? true;
  } catch {
    // Never let a settings-read failure take AI down (or keep it up): default ON,
    // but respect the env break-glass, already handled above.
    value = true;
  }
  cache = { value, at: now };
  return value;
}

/** Clears the in-process cache so the next read reflects a just-written value. */
export function invalidateAiEnabledCache(): void {
  cache = null;
}

/** Thrown by the AI client roots when AI is turned off, so callers degrade. */
export class AiDisabledError extends Error {
  constructor() {
    super("AI is turned off");
    this.name = "AiDisabledError";
  }
}
