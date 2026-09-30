// Portal read-only "window" — server helper.
//
// The buyer/seller portal is authenticated by a per-contact token. Real clients
// NEVER have a NextAuth session — they reach the portal purely via their link.
// Internal staff (agent / director / negotiator / progressor / founder) always
// DO have a session. So "someone with a session is viewing a portal page" means
// "an agent is looking at a client's portal", not the client themselves.
//
// When that's the case the portal must behave like a window: the agent can see
// exactly what the client sees, byte for byte, but nothing they do — and nothing
// the mere act of viewing does — may trip anything on the client's file. That
// means suppressing every PASSIVE side-effect of a view (visit stamps, unread
// clears, "since you were last here" tracking, engaged-time, PWA adoption pings)
// as well as every write.
//
// This also fixes a pre-existing quiet bug: before this, an agent opening a
// client's real portal link logged a fake client visit and cleared their unread
// badge — corrupting the very engagement signal the risk engine reads to decide
// who to chase.
//
// Cached per request so the layout and the active page share one session decode.

import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * True when the current portal request is being made by a logged-in internal
 * user (an agent/founder looking through the window), rather than the real
 * token-authenticated client. Drives every read-only + no-side-effect guard.
 */
export const isAgentPortalView = cache(async (): Promise<boolean> => {
  try {
    const session = await getServerSession(authOptions);
    return !!session?.user;
  } catch {
    // If session resolution ever throws, fail safe toward the CLIENT experience
    // (side-effects on) rather than silently turning a real client read-only.
    return false;
  }
});
