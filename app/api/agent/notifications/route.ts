import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAgentMilestoneActivity, resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { confirmationSentence, bellNotificationSentence, resolveConfirmer } from "@/lib/updates-copy";
import { prisma } from "@/lib/prisma";

// Non-milestone notification types the bell surfaces ("more than just
// confirmations"): a client added their chain agent (#16), set an expected
// date, or left a note on a chase reply. Strict allowlist so the legacy
// Notification backlog doesn't flood the bell; scoped to the caller's userId.
const BELL_NOTIFICATION_TYPES = [
  "portal_chain_agent_updated",
  "portal_expected_date_set",
  "portal_chase_note",
  "portal_chases_paused",
  // Enquiries rework: surface the tracker's 3-week "stalled" escalation, the
  // raise-chase "still not raised" escalation, and a solicitor leaving an
  // enquiries update, so self-managed (agent-owned) files see them in the bell.
  "enquiries_stalled",
  "enquiries_raise_stalled",
  "solicitor_update",
  // Broker card: a buyer asked their agency's own broker to call back (needs
  // the agent to pass it on), and the delivery-failed safety net. Both carry a
  // pre-rendered body the sentence builder falls back to.
  "broker_callback_requested",
  "broker_callback_bounced",
  // Tier-1 automation: a client's mortgage offer is nearing (or past) expiry.
  "mortgage_offer_expiring",
];

// The small pill shown on a bell item, per notification type. "Paused" for a
// chase pause; "Stalled" for the enquiries escalation; "Update" otherwise.
function pillLabelForType(type: string): string {
  if (type === "portal_chases_paused") return "Paused";
  if (type === "enquiries_stalled" || type === "enquiries_raise_stalled") return "Stalled";
  if (type === "broker_callback_requested" || type === "broker_callback_bounced") return "Broker";
  if (type === "mortgage_offer_expiring") return "Expiring";
  return "Update";
}

// Bell feed = the same "completed step" activity shown on the Updates page
// (/agent/comms), scoped through the canonical visibility resolver so every
// role sees the right files:
//   director / negotiator → their agency's files
//   sales_progressor      → their assigned files
//   admin / superadmin     → all files
//
// Returns the latest items for the dropdown menu + a count of how many are
// newer than the caller's last-read timestamp (the `after` param) for the
// unread badge. Rewritten 2026-08-09: was a bare count keyed on raw agencyId,
// which was wrong for internal staff (agencyId = null).

const MENU_LIMIT = 12;

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const after = req.nextUrl.searchParams.get("after");
  const since = after ? new Date(after) : new Date(0);

  const role = session.user.role;
  const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "viewer";
  const isAdmin = hasAdminPowers(session);
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const milestones = await getAgentMilestoneActivity(vis, false);

  const milestoneRows = milestones.map((m) => {
    const side = m.milestoneDefinition.side as "vendor" | "purchaser";
    const sideContacts = (m.transaction.contacts ?? [])
      .filter((c) => c.roleType === side)
      .map((c) => ({ id: c.id, name: c.name, isPrincipal: c.isPrincipal }));
    const resolved = resolveConfirmer(m, sideContacts);
    const confirmer = resolved.confirmer ?? ({ kind: "agent", name: m.completedBy?.name ?? "A colleague" } as const);
    const principals = resolved.principals;
    // For a portal/helper-confirmed step, show whoever confirmed (audit #16
    // phase 2): the exact contact if recorded, else the side's contact.
    const confirmingContact =
      confirmer.kind === "client" || confirmer.kind === "helper"
        ? (m.transaction.contacts ?? []).find((c) => c.id === m.confirmedByContactId)
          ?? (m.transaction.contacts ?? []).find((c) => c.roleType === side)
        : null;
    // A staff confirmation the viewer made themselves still shows in the
    // dropdown, but shouldn't drive the red unread badge — otherwise every
    // confirm you make re-alerts you about your own action. Client/helper
    // (portal) confirmations are someone else's and always count.
    const mine =
      m.completedById === session.user.id &&
      confirmer.kind !== "client" &&
      confirmer.kind !== "helper";
    return {
      at: new Date(m.completedAt ?? 0),
      countable: !mine,
      item: {
        id: m.id,
        txId: m.transaction.id,
        address: m.transaction.propertyAddress,
        sentence: confirmationSentence({ code: m.milestoneDefinition.code, side, confirmer, sideContacts: principals, milestoneName: m.milestoneDefinition.name, isDesktopValuation: m.milestoneDefinition.code === "PM6" && !m.eventDate }),
        who: confirmer.kind,
        avatarImage: confirmer.kind === "agent" ? (m.completedBy?.image ?? null)
          : confirmer.kind === "client" || confirmer.kind === "helper" ? (confirmingContact?.image ?? null)
          : null,
        avatarName: confirmer.kind === "agent" ? (m.completedBy?.name ?? "")
          : confirmer.kind === "client" || confirmer.kind === "helper" ? (confirmingContact?.name ?? "")
          : "",
        at: (m.completedAt ?? new Date()).toISOString(),
        updateLabel: null as string | null,
      },
    };
  });

  // Allowlisted non-confirmation notifications for this user (e.g. a client
  // added their chain agent). Scoped to session.user.id — no cross-tenant leak.
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id, type: { in: BELL_NOTIFICATION_TYPES } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { transaction: { select: { propertyAddress: true } } },
  });
  const notifRows = notifications.map((n) => {
    const payload = (n.payload ?? {}) as Record<string, unknown>;
    return {
      at: n.createdAt,
      countable: true,
      item: {
        id: n.id,
        txId: n.transactionId ?? "",
        address: n.transaction?.propertyAddress ?? "",
        sentence: bellNotificationSentence(n.type, payload),
        who: "client" as const,
        avatarImage: null as string | null,
        avatarName: "",
        at: n.createdAt.toISOString(),
        // Informational "for your awareness" item — a quiet pill tells it from
        // confirmations ("Paused" for a chase pause, "Update" otherwise).
        updateLabel: pillLabelForType(n.type),
      },
    };
  });

  // Merge both sources, newest first.
  const all = [...milestoneRows, ...notifRows].sort((a, b) => b.at.getTime() - a.at.getTime());
  const items = all.slice(0, MENU_LIMIT).map((r) => r.item);
  // Unread = everything newer than the last-read stamp (across the full set,
  // not just the menu slice, so the badge is accurate even past 12), EXCLUDING
  // the viewer's own staff confirmations — those still appear in the list but
  // don't re-alert you about an action you just took.
  const count = all.filter((r) => r.countable && r.at > since).length;

  return NextResponse.json({ count, items });
}
