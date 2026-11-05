"use server";

// Server actions for the property-hero File Summary popover.
//
// Both actions gate on the standard access-scope recipe (Law 7): a scoped
// findFirst proves the caller may read THIS file before anything else runs, so
// agency staff, assigned progressors, external businesses and the founder each
// only ever reach files in their own scope, and external businesses stay walled
// off from TSP and each other. Reading the cache does NOT call the AI;
// refreshing does. A failed refresh leaves the last good summary in place.

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import {
  getCachedFileSummary,
  generateFileSummary,
  type FileSummaryView,
} from "@/lib/services/file-summary";

type Result =
  | { ok: true; summary: FileSummaryView | null }
  | { ok: false; error: string };

// Resolve the viewer's scope and confirm they may read this file. Returns the
// file's lastActivityAt (for the stale check) alongside the scope, or null when
// the file isn't in scope.
async function authorise(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, lastActivityAt: true },
  });
  if (!tx) return null;
  return { scope, userId: session.user.id, lastActivityAt: tx.lastActivityAt };
}

// Read the cached summary. Never generates — returns null body when none exists
// so the UI can decide whether to kick off a first generation.
export async function getFileSummaryAction(transactionId: string): Promise<Result> {
  const auth = await authorise(transactionId);
  if (!auth) return { ok: false, error: "Not found" };
  try {
    const summary = await getCachedFileSummary(transactionId, auth.lastActivityAt);
    return { ok: true, summary };
  } catch {
    return { ok: false, error: "Couldn't load the summary." };
  }
}

// Generate a fresh summary and cache it. On failure the previous summary is
// untouched; the caller can keep showing it.
export async function refreshFileSummaryAction(transactionId: string): Promise<Result> {
  const auth = await authorise(transactionId);
  if (!auth) return { ok: false, error: "Not found" };
  try {
    const summary = await generateFileSummary(transactionId, auth.scope, auth.userId);
    if (!summary) return { ok: false, error: "There's not enough on this file to summarise yet." };
    return { ok: true, summary };
  } catch {
    return { ok: false, error: "Couldn't generate a summary just now. Try again in a moment." };
  }
}
