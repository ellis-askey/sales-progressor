"use server";

// Data for the Chain-tab right panel (the swap from Sale health): a mini steps
// view per side + the default notes feed (typed notes, logged calls, step
// confirmations and not-required). Read-only + access-scoped (Law 7). Fetched
// lazily client-side, only on the Chain tab, so no other tab pays for it.

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { getMilestonesCached } from "@/lib/services/cached-fetchers";
import { getActivityTimeline } from "@/lib/services/comms";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { formatTimestamp } from "@/lib/utils";

export type SidePanelStep = { code: string; label: string; state: "done" | "next" | "todo"; date: string | null };
export type SidePanelEntry = {
  id: string;
  kind: "note" | "call" | "step" | "nr";
  who: string;
  whoImage: string | null;
  whoRole: string;
  when: string;
  body: string;
};
export type ChainSidePanelData = { seller: SidePanelStep[]; buyer: SidePanelStep[]; entries: SidePanelEntry[] };

// A marked-not-required step reads as a short subject + "not required" rather
// than its done-phrased hero label (which would contradict). Only these can be
// N/R'd; anything else falls back to the hero label.
const NR_NOUN: Record<string, string> = { PM8: "Searches", PM9: "Survey", PM24: "Deposit", PM5: "Mortgage", PM6: "Mortgage", PM11: "Mortgage" };

// The concise done-state label for a step — the email hero label for the step's
// own side ("Solicitor instructed", "Mortgage application submitted", "Searches
// ordered"). Single source of truth with the client emails.
function shortLabel(code: string): string {
  const copy = getMilestoneCopy(code);
  const side = code.startsWith("PM") ? copy.emailCopy?.purchaser : copy.emailCopy?.vendor;
  return side?.heroLabel ?? copy.label ?? code;
}

function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
// "19th October 2027" — UK time so a date-only event date never slips a day.
function formatOrdinalDate(d: Date): string {
  const day = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric" }).format(d));
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long" }).format(d);
  const year = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric" }).format(d);
  return `${ordinal(day)} ${month} ${year}`;
}

export async function getChainSidePanelData(transactionId: string): Promise<ChainSidePanelData | null> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, agencyId: true },
  });
  if (!tx) return null;

  const [milestones, activity] = await Promise.all([
    getMilestonesCached(transactionId, tx.agencyId).catch(() => null),
    getActivityTimeline(transactionId, tx.agencyId).catch(() => []),
  ]);

  const toSteps = (
    defs: { code: string; isComplete: boolean; isNotRequired: boolean; completion: { eventDate: Date | null; completedAt: Date | null } | null }[] | undefined,
  ): SidePanelStep[] => {
    if (!defs) return [];
    let nextAssigned = false;
    return defs
      .filter((d) => !d.isNotRequired)
      .map((d): SidePanelStep => {
        if (d.isComplete) {
          // The user's own event date if they set one ("this happened on…"),
          // else when it was confirmed.
          const when = d.completion?.eventDate ?? d.completion?.completedAt ?? null;
          return { code: d.code, label: shortLabel(d.code), state: "done", date: when ? formatOrdinalDate(when) : null };
        }
        if (!nextAssigned) { nextAssigned = true; return { code: d.code, label: shortLabel(d.code), state: "next", date: null }; }
        return { code: d.code, label: shortLabel(d.code), state: "todo", date: null };
      });
  };

  const seller = toSteps(milestones?.vendor);
  const buyer = toSteps(milestones?.purchaser);

  // Default feed only: typed notes, logged calls, step confirmations, not-required.
  // Everything else (emails, chases, portal views, reminders) stays on Activity.
  const entries: SidePanelEntry[] = [];
  for (const e of activity) {
    if (e.kind === "milestone") {
      entries.push({
        id: e.id,
        kind: e.isNotRequired ? "nr" : "step",
        who: e.actorName,
        whoImage: e.actorImage,
        whoRole: e.actorRole,
        when: formatTimestamp(e.at),
        body: e.isNotRequired
          ? `${NR_NOUN[e.milestoneCode] ?? shortLabel(e.milestoneCode)} not required`
          : shortLabel(e.milestoneCode),
      });
    } else if (e.kind === "comm" && e.createdByRole) {
      // createdByRole separates a person's note/call from a logActivity system
      // note (contact added, chain changes, "viewed portal"…), which carries no
      // author role — so the system noise is excluded here. Other channels
      // (email / WhatsApp / SMS) are held back for the default view.
      const isCall = e.method === "phone";
      const isNote = e.type === "internal_note" && e.method == null;
      if (isCall || isNote) {
        entries.push({
          id: e.id,
          kind: isCall ? "call" : "note",
          who: e.actorName,
          whoImage: e.actorImage,
          whoRole: e.actorRole,
          when: formatTimestamp(e.at),
          body: e.content,
        });
      }
    }
  }

  return { seller, buyer, entries: entries.slice(0, 50) };
}
