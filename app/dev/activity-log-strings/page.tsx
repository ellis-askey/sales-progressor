"use client";

// /dev/activity-log-strings — a catalogue of EVERY our-side audit string that
// can land in the property-file "Activity & notes" feed, rendered through the
// REAL <ActivityTimeline> (the full Activity tab's renderer) so each one shows
// byte-for-byte how it ships. One seeded row per string, with realistic sample
// values in the [brackets]. Nothing is wired to data. Blocks in prod.
//
// These are the REWRITTEN strings (voice pass, 2026-11-09). The name prefix is
// gone from most lines because the feed already shows the actor's avatar + name.

import { notFound } from "next/navigation";
import type { ActivityEntry } from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";
import type { ActorRole } from "@/components/ui/Avatar";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";

type CommEntry = Extract<ActivityEntry, { kind: "comm" }>;
type Spec = { content: string } & Partial<CommEntry>;

const AGENT = "Ellis Askey";

// A seeded comm row. Everything an audit string needs; the rest is nulled.
function row(spec: Spec, i: number): ActivityEntry {
  return {
    kind: "comm",
    id: `seed-${i}`,
    // Fixed base date (avoids SSR/client hydration drift), 1 min apart so order
    // is stable and the list reads top-to-bottom in catalogue order.
    at: new Date(new Date("2026-03-12T14:30:00Z").getTime() - i * 60_000),
    type: "internal_note" as CommType,
    method: null as CommMethod | null,
    createdById: null,
    createdByName: AGENT,
    createdByImage: null,
    createdByRole: "sales_progressor",
    contactNames: [],
    contactIds: [],
    recipientName: null,
    visibleToClient: false,
    wasEdited: false,
    editedAt: null,
    wasAiGenerated: false,
    isAutomated: false,
    tone: null,
    subject: null,
    rawOriginal: null,
    conversationId: null,
    aiRead: null,
    contactSuggestion: null,
    senderLabel: null,
    mediaUrl: null,
    mediaType: null,
    actorRole: "progressor" as ActorRole,
    actorName: AGENT,
    actorImage: null,
    actorSubLabel: null,
    replies: [],
    ...spec,
  };
}

const sys = { actorRole: "system" as ActorRole, actorName: "The Sales Progressor", isAutomated: true };
const out = (method: CommMethod): Partial<CommEntry> => ({ type: "outbound" as CommType, method });

// ── The catalogue, in the order of the rewrite list ────────────────────
const SPECS: Spec[] = [
  // Steps & milestones
  { content: `"Searches ordered" marked as not required. Reason: Cash buyer, no searches needed` },
  { content: `"Draft contract issued" marked as incomplete. Reason: Marked in error` },
  { content: `"Enquiries raised" marked as incomplete because an earlier milestone was reversed.` },
  { content: `"Searches ordered" confirmation undone.` },
  { content: `"Enquiries raised" reset following the reversal of "Draft contract issued".` },
  { content: `Sale completed. Confirmed by both parties.` },
  { content: `Sale reopened following the reversal of a completion milestone.` },
  { content: `Lender valuation date changed from 12 March to 19 March.` },
  { content: `Purchase changed to mortgage-funded. Mortgage application, valuation and offer marked complete, as the offer was already in place.` },

  // Reminders & chasing
  { content: `"Chase seller's solicitor for enquiries" snoozed until 19 March.` },
  { content: `"Chase buyer's solicitor" escalated. Reason: No response in 10 days` },
  { content: `Manual chase recorded.`, ...out("phone") },
  { content: `Enquiries reminder snoozed until 19 March. Reason: Awaiting solicitor callback` },
  { content: `Enquiries update recorded. Called the seller's solicitor: They'll reply by Friday`, ...out("phone") },
  { content: `Seller communication reminder snoozed. Reason: Spoke to them directly today` },

  // Client emails & notifications
  { content: `Client updates for Mr David Braddon, Mr Cliff Russell and Mr Dean Russell not sent. Milestones remain confirmed.` },
  { content: `Client update emails sent immediately, without the usual 5-minute delay.` },
  { content: `Searches ordered completed. No client update sent.` },
  { content: `Lender valuation recorded. No client update sent, as the mortgage offer was already confirmed.` },
  { content: `Searches ordered recorded as completed. No client update sent because the completion date was in the past.` },
  { content: `Portal invitation sent to Dean (dean.russell@email.com).`, ...sys },
  { content: `Survey quote link sent to Dean (dean.russell@email.com). Link: https://portal.thesalesprogressor.co.uk/portal/abc123`, ...out("email") },

  // The chain
  { content: `No chain required.` },
  { content: `Sale reopened for chain setup.` },
  { content: `14 Oak Lane, Dartford ready to exchange. Confirmation received.` },
  { content: `Chain details updated.` },
  { content: `Chain update recorded: Seller's purchase above is now at exchange` },

  // People on the file
  { content: `Sarah Jones added as purchaser.` },
  { content: `Sarah Jones's contact details updated.` },
  { content: `Sarah Jones removed from the file.` },
  { content: `Portal access link reset for Dean Russell.` },
  { content: `Hodders Law added as Vendor solicitor.` },
  { content: `Hodders Law's details updated.` },
  { content: `Hodders Law removed from the file.` },
  { content: `Seller introduction call completed.` },

  // Sale details
  { content: `Sale status changed from Active to Completed. Reason: Completed today` },
  { content: `Purchase price updated from £450,000 to £455,000.` },
  { content: `Completion date set to 24 March 2026.` },
  { content: `Completion date removed.` },
  { content: `Expected exchange date set to 17 March 2026.` },
  { content: `Expected exchange date updated to 17 March 2026.` },
  { content: `Expected exchange date recalculated to 17 March 2026.` },
  { content: `Expected exchange date set to 17 March 2026 and synced across the chain.` },
  { content: `Progression service changed from self-managed to outsourced.` },
  { content: `Sale restarted with a new buyer, Tom Whitfield (round 2). Previous buyer withdrew: Buyer pulled out.` },
  { content: `Agent fee updated.` },
  { content: `File assigned to Laura Smith.` },
  { content: `File reassigned to Laura Smith.` },
  { content: `File unassigned.` },
  { content: `Solicitor details updated.` },
  { content: `Sale details added.` },
  { content: `Purchase type changed to Mortgage.` },
  { content: `Client email address added.` },
  { content: `Client email address updated.` },
  { content: `Referral details updated.` },
  { content: `Broker referral details updated.` },
  { content: `Property address updated to 99 Kings Drive, Gravesend, DA12 5BQ.` },
  { content: `Property type changed to share of freehold.` },
  { content: `Housing association details added.` },
  { content: `Managed development confirmed. Management pack required.` },
  { content: `Managed development status removed. Management pack no longer flagged as required.` },

  // Exchange day
  { content: `Exchange planned for today. Agreed completion date: 24 March 2026.` },
  { content: `Exchange no longer planned for today.` },

  // Free-typed note (author writes the words) — pinned as a Setup note
  { content: `No chain below or above this transaction. Limited company purchase. MIP in progress`, subject: "Setup note" },
];

export default function ActivityLogStringsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const entries = SPECS.map((s, i) => row(s, i));

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 80px" }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: 0 }}>Catalogue · /dev</p>
      <h1 style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 700, color: "var(--agent-text-primary)" }}>Activity-feed audit strings — rewritten</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
        The rewritten copy, rendered through the real timeline — one row each, byte-for-byte how they&apos;ll show. The name prefix is gone from most lines because the actor&apos;s avatar and name already sit above the text. Sample values are in [sensible] placeholders. The timeline shows the latest ten; use &ldquo;Show earlier updates&rdquo; to see them all.
      </p>

      <ActivityTimeline entries={entries} transactionId="dev-activity-log-strings" />
    </div>
  );
}
