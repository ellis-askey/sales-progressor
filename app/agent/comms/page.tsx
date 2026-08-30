import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import {
  getAgentUpdatesFeed,
  getFileSnapshots,
  resolveAgentVisibility,
  resolveInternalVisibility,
  type UpdateFeedEntry,
} from "@/lib/services/agent";
import { ChartLine } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { CommsEmptyState } from "@/components/agent/CommsEmptyState";
import {
  CommsActivityFeed,
  type DayBucket,
  type TxGroup,
  type UpdateRow,
} from "@/components/comms/CommsActivityFeed";
import { toUKDateStr } from "@/lib/utils";
import { getSignedUrlMap } from "@/lib/supabase-storage";

function dayLabel(d: Date | string) {
  const date = new Date(d);
  const todayStr = toUKDateStr(new Date());
  const yesterdayStr = toUKDateStr(new Date(Date.now() - 86_400_000));
  const dStr = toUKDateStr(date);
  if (dStr >= todayStr) return "Today";
  if (dStr >= yesterdayStr) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// Map a service entry to the client render row, resolving the document's signed
// link from the batch-signed map.
function toRow(e: UpdateFeedEntry, signed: Map<string, string>): UpdateRow {
  const base = { id: e.id, atIso: e.at.toISOString(), who: e.who, side: e.side };
  switch (e.kind) {
    case "milestone":
      return { ...base, kind: "milestone", code: e.code, stageKey: e.stageKey, sentence: e.sentence, byName: e.byName, byImage: e.byImage };
    case "price":
      return { ...base, kind: "price", oldPrice: e.oldPrice, newPrice: e.newPrice, reason: e.reason, byName: e.byName };
    case "note":
      return { ...base, kind: "note", content: e.content, byName: e.byName, byImage: e.byImage };
    case "reply":
      return { ...base, kind: "reply", content: e.content };
    case "document":
      return { ...base, kind: "document", filename: e.filename, mimeType: e.mimeType, docUrl: e.storagePath ? signed.get(e.storagePath) ?? null : null, byName: e.byName };
  }
}

export default async function AgentCommsPage() {
  const session = await requireSession();

  const isInternalStaff = session.user.role === "admin" || session.user.role === "sales_progressor" || session.user.role === "viewer";
  const isProgressor = session.user.role === "sales_progressor";
  const isAdmin = hasAdminPowers(session);
  const vis = isInternalStaff
    ? resolveInternalVisibility(session.user.id, session.user.role, isAdmin)
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const entries = await getAgentUpdatesFeed(vis);

  // Sign every property photo AND document link in one round trip.
  const signPaths: (string | null)[] = [
    ...entries.map((e) => e.transaction.photoStoragePath),
    ...entries.flatMap((e) => (e.kind === "document" ? [e.storagePath] : [])),
  ];
  const signedMap = await getSignedUrlMap(signPaths);

  // Per-file snapshot (progress %, stage, next step) for the right column.
  const snapshotMap = await getFileSnapshots(vis, entries.map((e) => e.transaction.id));

  // Group into day buckets, each day grouped by transaction.
  const dayOrder: string[] = [];
  const dayTxMap = new Map<string, Map<string, TxGroup>>();

  for (const e of entries) {
    const label = dayLabel(e.at);
    if (!dayTxMap.has(label)) {
      dayTxMap.set(label, new Map());
      dayOrder.push(label);
    }
    const txMap = dayTxMap.get(label)!;
    if (!txMap.has(e.transaction.id)) {
      txMap.set(e.transaction.id, {
        transactionId: e.transaction.id,
        transactionAddress: e.transaction.propertyAddress,
        photoUrl: e.transaction.photoStoragePath ? signedMap.get(e.transaction.photoStoragePath) ?? null : null,
        expectedExchangeIso: e.transaction.expectedExchangeDate ? e.transaction.expectedExchangeDate.toISOString() : null,
        status: e.transaction.status,
        snapshot: snapshotMap.get(e.transaction.id) ?? null,
        updates: [],
      });
    }
    txMap.get(e.transaction.id)!.updates.push(toRow(e, signedMap));
  }

  const days: DayBucket[] = dayOrder.map((label) => ({
    label,
    txGroups: Array.from(dayTxMap.get(label)!.values()),
    defaultOpen: label === "Today" || label === "Yesterday",
  }));

  return (
    <>
      <PageHeader
        title="Updates"
        subtitle={
          isAdmin      ? "What's happened across the platform." :
          isProgressor ? "What's happened on your assigned files." :
                         "What's happened across your files."
        }
      />

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-4">

        {/* Brand-new agency user: the onboarding empty state (matches the mock). */}
        {entries.length === 0 && !isInternalStaff && <CommsEmptyState />}

        {entries.length === 0 && isInternalStaff && (
          <>
            <div className="agent-glass-strong agent-empty-card" style={{ padding: "48px 24px", textAlign: "center" }}>
              <ChartLine weight="regular" style={{ width: 32, height: 32, color: "var(--agent-text-muted)", margin: "0 auto 16px", display: "block", opacity: 0.45 }} />
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                No updates yet
              </p>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)", maxWidth: 340, lineHeight: 1.5 }}>
                {isAdmin
                  ? "Confirmed steps, price changes, shared notes, replies, and uploads appear here as they happen across the platform."
                  : isProgressor
                    ? "Confirmed steps, price changes, shared notes, replies, and uploads on your assigned files appear here."
                    : "Confirmed steps, price changes, shared notes, replies, and uploads appear here as they happen."}
              </p>
            </div>

            {/* Ghost day-bucket preview — abstract agent-skeleton bars. */}
            <div style={{ opacity: 0.35, pointerEvents: "none" }}>
              <div className="agent-glass" style={{ overflow: "hidden" }}>
                <div className="agent-acc-hdr">
                  <div className="agent-skeleton" style={{ width: 56, height: 11, borderRadius: 4 }} />
                  <div className="agent-skeleton" style={{ width: 68, height: 11, borderRadius: 4 }} />
                </div>
                <div className="agent-acc open">
                  <div className="agent-acc-in">
                    <div className="agent-acc-body">
                      <div className="glass-card overflow-hidden">
                        <div className="px-4 py-2.5" style={{ borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
                          <div className="agent-skeleton" style={{ width: 156, height: 10, borderRadius: 4 }} />
                        </div>
                        {([148, 190] as const).map((w, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-3" style={{
                            borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
                          }}>
                            <div className="agent-skeleton mt-0.5 w-5 h-5 flex-shrink-0" style={{ borderRadius: "50%" }} />
                            <div className="flex-1 space-y-2">
                              <div className="agent-skeleton h-3" style={{ maxWidth: w, borderRadius: 4 }} />
                              <div className="agent-skeleton h-2.5" style={{ maxWidth: 52, borderRadius: 4 }} />
                            </div>
                            <div className="agent-skeleton h-2.5 w-8 flex-shrink-0" style={{ borderRadius: 4 }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {days.length > 0 && <CommsActivityFeed days={days} />}

      </div>
    </>
  );
}
