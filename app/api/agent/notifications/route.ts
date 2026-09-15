import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { getAgentMilestoneActivity, resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { confirmationSentence, bellNotificationSentence, resolveConfirmer, BELL_NOTIFICATION_TYPES, pillLabelForType } from "@/lib/updates-copy";
import { prisma } from "@/lib/prisma";

// BELL_NOTIFICATION_TYPES + pillLabelForType now live in lib/updates-copy so the
// Updates feed can share the same allowlist and stay a superset of the bell.

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
        // The confirming side, so the bell can tint the branded fallback avatar
        // (seller blue / buyer green) when the client has no photo.
        side,
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
        // Non-milestone notifications are genuinely side-agnostic (chain agent
        // added, chase note, etc.) — no side to tint by, so the neutral person.
        side: null as "vendor" | "purchaser" | null,
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
