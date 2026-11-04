// Welcome-call script — the numbered talking points on a file's intro-call drawer.
// Three tiers resolved at render: a member's personal override (User.agentPreferences
// .introCallScript) → their agency's version (Agency.introCallScript, director-edited)
// → the platform default below. Each tier is the same shape; null/absent falls through.

export type WelcomeCallPoint = { title: string; body: string; note: string };

// Platform default — Ellis-approved copy (voice rules apply). The seed every
// agency starts on and the final fallback.
export const DEFAULT_WELCOME_CALL_SCRIPT: WelcomeCallPoint[] = [
  { title: "Keep in touch with your solicitor", body: "Try to speak to them at least once a fortnight, and follow up on anything they're waiting for from you.", note: "We'll do plenty of chasing too, but keeping that direct relationship going really helps." },
  { title: "Keep us in the loop", body: "If anything changes, tell us. A survey issue, a change of plan, something your solicitor has mentioned, even something that seems minor.", note: "The more we know, the more useful we can be." },
  { title: "We'll tell you when we need you", body: "You don't need to constantly wonder what you should be doing next. When something needs your attention, we'll let you know what it is and what you need to do.", note: "Until then, you can get on with everything else." },
  { title: "Make the most of your portal", body: "Your portal is the easiest place to see where things stand, what's happened and what comes next.", note: "And if something doesn't make sense, just ask us. That's what we're here for." },
  { title: "If something feels stuck, tell us", body: "Don't assume we already know. If you've been waiting too long, can't get an answer or something just doesn't feel right, let us know.", note: "We'd much rather you tell us early, so we can look into it and help move things forward." },
];

// Guard rails so a stored blob can't bloat the UI or crash a render.
export const MAX_WELCOME_CALL_POINTS = 12;
const MAX_TITLE = 120;
const MAX_BODY = 600;
const MAX_NOTE = 600;

/** Validate + clean a stored/submitted script. Returns null when it isn't a
 *  usable array (so the caller falls through to the next tier). Drops empty
 *  points, trims + caps each field, and caps the count. */
export function sanitiseWelcomeCallScript(input: unknown): WelcomeCallPoint[] | null {
  if (!Array.isArray(input)) return null;
  const out: WelcomeCallPoint[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim().slice(0, MAX_TITLE) : "";
    const body = typeof r.body === "string" ? r.body.trim().slice(0, MAX_BODY) : "";
    const note = typeof r.note === "string" ? r.note.trim().slice(0, MAX_NOTE) : "";
    // A point needs at least a title or body to be worth keeping.
    if (!title && !body) continue;
    out.push({ title, body, note });
    if (out.length >= MAX_WELCOME_CALL_POINTS) break;
  }
  return out.length > 0 ? out : null;
}

/** Effective script for a viewer: their personal override, else their agency's
 *  version, else the platform default. Inputs are the raw stored JSON values. */
export function resolveWelcomeCallScript(personal: unknown, agency: unknown): WelcomeCallPoint[] {
  return sanitiseWelcomeCallScript(personal) ?? sanitiseWelcomeCallScript(agency) ?? DEFAULT_WELCOME_CALL_SCRIPT;
}

/** Read a member's personal script off the agentPreferences JSON blob. */
export function readPersonalWelcomeCallScript(prefs: unknown): WelcomeCallPoint[] | null {
  if (!prefs || typeof prefs !== "object") return null;
  return sanitiseWelcomeCallScript((prefs as Record<string, unknown>).introCallScript);
}
