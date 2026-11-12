import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getVisibleUpdates, type ViewerContext } from "@/lib/platform-updates/feed";
import { WhatsNewFeed } from "@/components/whats-new/WhatsNewFeed";
import { MarkWhatsNewSeen } from "@/components/whats-new/MarkWhatsNewSeen";

// Agent-facing "What's new" (Phase 2). Read-only. Dynamic so a publish/hide
// shows/removes immediately with no deploy. The route lives under /agent/* so
// only agent-app users (never portal/Boardwalk) can reach it; visibility is then
// scoped by audience + status in getVisibleUpdates — all server-side.
export const dynamic = "force-dynamic";

export default async function WhatsNewPage() {
  const session = await requireSession();
  const role = session.user.role;
  const ctx: ViewerContext = {
    // A progression-business member (progressor) is bucketed as such first.
    isBusinessMember: !!session.user.progressionBusinessId,
    isInternalStaff: role === "admin" || role === "sales_progressor" || role === "superadmin",
  };

  const updates = await getVisibleUpdates(ctx);
  // Server-side enforcement: no page unless a published, audience-relevant update
  // exists. A direct URL hit 404s when the feature isn't "on" for this viewer,
  // matching the sidebar item's presence. Drafts/other audiences never qualify.
  if (updates.length === 0) notFound();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "4px 2px 40px" }}>
      {/* Clears the unread dot on real open (mount), not on prefetch. */}
      <MarkWhatsNewSeen />

      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 780, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>
          What&apos;s new
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14.5, lineHeight: 1.5, color: "var(--agent-text-muted)", maxWidth: "56ch" }}>
          The latest features, improvements and changes across the platform.
        </p>
      </header>

      <WhatsNewFeed updates={updates} />
    </div>
  );
}
