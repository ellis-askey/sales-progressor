"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X, Plus } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkCard, ChainConnector, ChainCardExpand, isChainCardExpandable, chainStatusMeta, chainChasedMeta, chainWithdrawalBadges } from "@/components/chain/LinkCard";
import { ChaseNeighbourDrawer } from "@/components/chase/ChaseNeighbourDrawer";
import type { NeighbourChaseDirection } from "@/lib/services/neighbour-chase";
import { saveChainIntelAction, addChainEntryAction } from "@/app/actions/chain-intel";
import type { ChainNodeIntelInput } from "@/lib/chain/intel";
import { ChainActivityCard } from "@/components/chain/ChainActivityCard";
import type { ChainV2, ChainTabPayload } from "@/lib/services/chains";
import { computeChainSummary, formatChainValueShort, formatChainPriceFull } from "@/lib/chain/summary";
import { isChainBroken } from "@/lib/chain/is-broken";
import { computeChainBottleneck } from "@/lib/chain/bottleneck";
import type { EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { canAddAbove, canAddBelow, canEditLink, isInternalStaff } from "@/lib/chain/permissions";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useOverlayChrome } from "@/lib/agent/use-overlay-chrome";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { DateField } from "@/components/ui/DateField";
import dynamic from "next/dynamic";
import { type ChainMapNode, type ChainMapMove, type ChainMapStatus, type ChainMapDetail } from "@/components/chain/chain-map-shared";
import { ChainMapPanel, type ChainMapPanelItem, type ChainMapActions, type ChainMapCta } from "@/components/chain/ChainMapPanel";
import { getChainLinkStatus, chainLinkStatusLabel } from "@/lib/chain/status";
import { displayChainPosition } from "@/lib/chain/positions";

// Client-only (WebGL) — matches how the My Files map loads PropertyMap. The
// visible loading fallback also tells us the pane is sized if the map is slow.
const ChainGeoMap = dynamic(() => import("@/components/chain/ChainGeoMap").then((m) => m.ChainGeoMap), {
  ssr: false,
  loading: () => <div className="chn-map-loading">Loading map…</div>,
});

// This file holds ONE chain body — `ChainView` — rendered two ways:
//   - variant="drawer" (default): a right-hand slide-over via createPortal, used
//     off the property file (the Chains workspace). `ChainDrawer` is the thin
//     wrapper for that.
//   - variant="inline": the same body rendered flat into a page, used by the
//     Chain tab on the property file (ChainTabPanel). No portal, no backdrop, no
//     close button, no scroll-lock.
// One source of truth so the tab and the drawer never drift apart.
type ChainViewProps = {
  transactionId: string;
  currentUserId: string;
  // Session role — lets internal staff (admin / superadmin / sales_progressor)
  // edit chains on outsourced files they progress but didn't originate.
  currentUserRole?: string | null;
  // Called when the drawer chrome closes. Ignored in inline (tab) mode.
  onClose: () => void;
  // "drawer" = portal slide-over (default). "inline" = flat page tab.
  variant?: "drawer" | "inline";
  // forkFromLinkId set => opening the drawer to add an EXTRA onward purchase (a
  // branch) forking above that sale, rather than a normal above/below stub.
  onOpenAddNode?: (
    direction: "above" | "below",
    chainId: string,
    editingLink?: EditingLinkData,
    forkFromLinkId?: string,
    aboveOfLinkId?: string,
    // Insert-between: slot a new sale at a specific interior position beside an
    // anchor link, rather than a column top or the chain ends.
    insertBetween?: { anchorLinkId: string; placement: "above" | "below" },
    // Land the edit drawer on the agent-email field (the "Add email" CTA).
    focusField?: "agentEmail",
  ) => void;
  declineNotification?: { address: string; at: string } | null;
  refreshKey?: number;
  // Server-rendered first payload (ij13f6). When present, the chain renders
  // immediately with no client fetch + second skeleton; live refetches (after a
  // mutation, via refreshKey) still hit /api/chains. Absent in drawer mode,
  // which fetches on open as before.
  initialChainData?: ChainTabPayload | null;
};

function ChainIcon() {
  return (
    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

// The fork connector: lines fanning from the fork-node card (bottom centre) up
// to each onward column above it — a V for 2, a trident for 3. The SVG stretches
// to the columns' width (preserveAspectRatio none), and non-scaling strokes keep
// the lines crisp at any width.
function ForkConnector({
  count,
  legs,
  onInsert,
}: {
  count: number;
  // One entry per leg (same order as the columns above), so a "+" can be placed
  // on each. Omitted / no onInsert = a plain connector.
  legs?: { onwardId: string }[];
  onInsert?: (anchorOnwardId: string) => void;
}) {
  const H = 26;
  return (
    <div className="chain-fork-connector">
      <svg width="100%" height={H} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden style={{ display: "block", overflow: "visible" }}>
        {Array.from({ length: count }).map((_, i) => {
          const x = ((i + 0.5) / count) * 100;
          return (
            <line key={i} x1={50} y1={H} x2={x} y2={0} stroke="var(--agent-border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          );
        })}
      </svg>
      {/* Insert-between "+" per leg, sitting at the 50% midpoint of each diagonal
          (the leg runs from the fork node at x=50 up to x=((i+0.5)/count)*100). */}
      {onInsert && legs?.map((leg, i) => {
        const x = ((i + 0.5) / count) * 100;
        const midX = (50 + x) / 2;
        return (
          <button
            key={leg.onwardId}
            type="button"
            onClick={() => onInsert(leg.onwardId)}
            className="chain-fork-insert"
            style={{ left: `${midX}%`, top: "50%" }}
            aria-label="Insert a sale here"
            title="Insert a sale here"
          >
            +
          </button>
        );
      })}
    </div>
  );
}

// "Late Sept" style month band — coarse on purpose (a chain-level completion
// forecast is never precise). Only ever rendered when MEDIANS_READY has already
// gated the date to a real prediction inside computeChainSummary.
function formatCompletionBand(date: Date): string {
  const d = new Date(date);
  const day = d.getDate();
  const part = day <= 10 ? "Early" : day <= 20 ? "Mid" : "Late";
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${part} ${month}`;
}

// Right-column value + health card. Every figure is a real derivation from the
// live chain (computeChainSummary); rows with no honest value are omitted.
function ChainSummaryCard({ chain }: { chain: ChainV2 }) {
  const s = computeChainSummary(chain);
  const claimPct = s.totalCount ? Math.round((s.claimedCount / s.totalCount) * 100) : 0;
  const riskLabel = s.risk === "high" ? "High" : s.risk === "medium" ? "Medium" : "Low";
  const riskClass = s.risk === "high" ? "danger" : s.risk === "medium" ? "warn" : "";

  return (
    <div className="chain-scard">
      <div className="chain-slab">Chain value</div>
      <div className="chain-sval">
        {s.totalValuePence != null ? formatChainValueShort(s.totalValuePence) : "Not priced yet"}
      </div>
      {s.totalValuePence != null && (
        <div className="chain-smeta">
          Across the {s.pricedCount} priced {s.pricedCount === 1 ? "sale" : "sales"}
        </div>
      )}

      <div className="chain-claimwrap">
        <div className="chain-claimrow">
          <span className="k">Claim rate</span>
          <span className="v">{s.claimedCount} of {s.totalCount}</span>
        </div>
        <div className="chain-claimbar"><i style={{ width: `${claimPct}%` }} /></div>
      </div>

      {s.weakest && (
        <div className="chain-srow">
          <span className="k">Weakest link</span>
          <span className={`v ${s.weakest.tone}`}>Link {s.weakest.position}</span>
        </div>
      )}
      {s.predictedCompletion && (
        <div className="chain-srow">
          <span className="k">Predicted completion</span>
          <span className="v">{formatCompletionBand(s.predictedCompletion)}</span>
        </div>
      )}
      {s.oldestSaleDays != null && (
        <div className="chain-srow">
          <span className="k">Oldest sale</span>
          <span className="v">{s.oldestSaleDays} days</span>
        </div>
      )}
      <div className="chain-srow">
        <span className="k">Chain risk</span>
        <span className={`v ${riskClass}`}>{riskLabel}</span>
      </div>
    </div>
  );
}

// "Come back to this on" date helpers for the ASKED_TO_WAIT response. Both
// return an ISO yyyy-mm-dd string suitable for a native date input.
function tomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function defaultWaitDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function ChainView({
  transactionId,
  currentUserId,
  currentUserRole,
  onClose,
  variant = "drawer",
  onOpenAddNode,
  declineNotification,
  refreshKey = 0,
  initialChainData = null,
}: ChainViewProps) {
  const inline = variant === "inline";
  const { theme, isNight } = usePortalTheme();
  // Internal staff progress files they didn't originate — they get the same
  // edit reach the server now grants (mirrors canViewChain).
  const isInternal = isInternalStaff(currentUserRole);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  function doClose() {
    if (!closing) {
      setClosing(true);
      closeTimer.current = setTimeout(onClose, 200);
    }
  }
  // Inline (tab) mode must not scroll-lock the page or hijack Escape.
  useOverlayChrome(doClose, !inline);
  const [chain, setChain] = useState<ChainV2 | null>(initialChainData?.chain ?? null);
  // Timeline (the cards) vs Map (the geographic command centre). Drawer-only.
  const [view, setView] = useState<"timeline" | "map" | "activity">("timeline");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Mobile: the panel is a bottom sheet — peek by default, tap the handle to open.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notAParticipant, setNotAParticipant] = useState(initialChainData?.notAParticipant ?? false);
  // Seeded server-side (inline tab) → not loading; drawer opens with a fetch.
  const [loading, setLoading] = useState(initialChainData == null);
  const [sendingInvites, setSendingInvites] = useState<string | null>(null);
  const [declineDismissed, setDeclineDismissed] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState<Array<{
    id: string;
    type: "LOST_BUYER" | "LOST_PURCHASE" | "ASKED_TO_WAIT";
    direction: "UPWARD" | "DOWNWARD";
    triggeringLinkId: string;
    createdAt: string;
  }>>([]);
  const [directional, setDirectional] = useState<Record<string, { upward: string | null; downward: string | null }>>({});
  const [submittingNotificationId, setSubmittingNotificationId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);
  // "Come back to this on" date per ASKED_TO_WAIT notification. Defaults to two
  // weeks out; the file is put on hold until this date, then resurfaces on the
  // hub for the agent to decide (wait on, remarket, or withdraw).
  const [waitDateByNotif, setWaitDateByNotif] = useState<Record<string, string>>({});

  async function dismissDecline() {
    setDeclineDismissed(true);
    await fetch("/api/chain/dismiss-decline", { method: "POST" }).catch(() => null);
  }

  async function respondToNotification(
    notificationId: string,
    status: "REMARKETING" | "WAITING" | "BREAK_CHAIN" | "WITHDRAW",
    reviewDate?: string,
  ) {
    setSubmittingNotificationId(notificationId);
    setRespondError(null);
    try {
      const res = await fetch(`/api/chains/notifications/${notificationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewDate ? { status, reviewDate } : { status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRespondError(body.error ?? "Couldn't save your response. Please reload and try again.");
        return;
      }
      await fetchChainAndRefresh();
    } catch {
      setRespondError("Network error. Please reload and try again.");
    } finally {
      setSubmittingNotificationId(null);
    }
  }
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const { toast } = useAgentToast();

  // Seeded server-side (inline tab): pre-fill the seen-link set + mark past the
  // first load so the background reconcile fetch neither shows a skeleton nor
  // flags the seeded links as "new".
  const seenLinkIds = useRef<Set<string>>(new Set(initialChainData?.chain?.links.map((l) => l.id) ?? []));
  const firstLoad = useRef(initialChainData?.chain == null);
  const [newLinkIds, setNewLinkIds] = useState<Set<string>>(new Set());
  // Local bump for the activity feed (added to the parent's refreshKey) so a
  // neighbour chase refetches the feed in place without needing a reopen.
  const [activityTick, setActivityTick] = useState(0);

  const router = useRouter();

  const fetchChain = useCallback(async () => {
    // Only show the skeleton when we have nothing yet (first load, drawer mode).
    // Seeded inline tabs + refetches after a mutation reconcile silently.
    if (firstLoad.current) setLoading(true);
    try {
      const res = await fetch(`/api/chains?transactionId=${transactionId}`);
      const data = await res.json();
      const next: ChainV2 | null = data.chain ?? null;
      const ids: string[] = next?.links.map((l) => l.id) ?? [];

      if (firstLoad.current) {
        seenLinkIds.current = new Set(ids);
        firstLoad.current = false;
      } else {
        const fresh = new Set(ids.filter((id) => !seenLinkIds.current.has(id)));
        if (fresh.size > 0) {
          setNewLinkIds(fresh);
          seenLinkIds.current = new Set(ids);
        } else {
          seenLinkIds.current = new Set(ids);
        }
      }

      setChain(next);
      // 2026-07-14: when the API gates the viewer out (chain exists but
      // they're not a chain participant AND not internal staff) it now
      // returns notAParticipant: true so we can render honest copy instead
      // of the "No chain yet + Create" empty state - the latter set up an
      // accidental double-create trap.
      setNotAParticipant(data.notAParticipant === true);
      setPendingNotifications(data.pendingNotifications ?? []);
      setDirectional(data.directional ?? {});
    } catch {
      // Network error — show empty state
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  // After a mutation, refetch the drawer AND refresh the current route's server
  // components. Chain mutations go through /api/chains route handlers, which
  // cannot revalidate on their own, so without this the surrounding chains
  // workspace (counts, tab membership), the file page, and the layout
  // chain-decline banner stay stale until reload. See
  // docs/UI_STATE_SYNCHRONISATION_AUDIT.md (RC2). The initial load below uses
  // plain fetchChain so opening the drawer doesn't refresh the page behind it.
  const fetchChainAndRefresh = useCallback(async () => {
    await fetchChain();
    router.refresh();
  }, [fetchChain, router]);

  useEffect(() => {
    fetchChain();
  }, [fetchChain, refreshKey]);

  // Clear the reveal flag after the 150ms animation has played out
  useEffect(() => {
    if (newLinkIds.size === 0) return;
    const t = setTimeout(() => setNewLinkIds(new Set()), 200);
    return () => clearTimeout(t);
  }, [newLinkIds]);

  async function handleResendInvite(linkId: string) {
    setSendingInvites(linkId);
    try {
      const chainId = chain?.id;
      if (!chainId) return;
      const res = await fetch(`/api/chains/${chainId}/links/${linkId}/invite`, {
        method: "POST",
      });
      if (res.ok) {
        const sent = 1;
        toast.success(`${sent} invite${sent !== 1 ? "s" : ""} sent`);
        await fetchChainAndRefresh();
      } else {
        toast.error("Couldn't send invite");
      }
    } finally {
      setSendingInvites(null);
    }
  }

  // Manual share link: create-or-return the slot's token, copy it, and refetch so
  // the ⋯ menu gains "Revoke" on the next open. Separate from the email invite.
  async function handleCopyShareLink(linkId: string) {
    if (!chain) return;
    try {
      const res = await fetch(`/api/chains/${chain.id}/links/${linkId}/share`, { method: "POST" });
      const data: { url?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error("Couldn't create the share link");
        return;
      }
      await navigator.clipboard.writeText(data.url);
      toast.success("Link copied");
      await fetchChainAndRefresh();
    } catch {
      toast.error("Couldn't copy the share link");
    }
  }

  async function handleRevokeShareLink(linkId: string) {
    if (!chain) return;
    const res = await fetch(`/api/chains/${chain.id}/links/${linkId}/share`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Share link revoked");
      await fetchChainAndRefresh();
    } else {
      toast.error("Couldn't revoke the share link");
    }
  }

  async function handleUploadPhoto(linkId: string, file: File): Promise<void> {
    if (!chain) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/chains/${chain.id}/links/${linkId}/photo`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Couldn't upload that photo");
      return;
    }
    toast.success("Photo added");
    await fetchChainAndRefresh();
  }

  async function handleSaveIntel(linkId: string, input: ChainNodeIntelInput) {
    // Server action re-checks edit permission (lib/chain/intel.ts); throws on
    // failure so LinkCard surfaces the inline error. Refetch to show saved values.
    await saveChainIntelAction(linkId, input);
    await fetchChainAndRefresh();
  }

  async function handleAddEntry(linkId: string, body: string) {
    // Server action re-checks edit permission + stamps lastChainCheckAt; throws
    // on failure so the log surfaces the inline error. Pass the file we're
    // viewing so the Activity-tab mirror lands on THIS file, not the node's own
    // file. Refetch to pull the new entry (and the refreshed check date).
    await addChainEntryAction(linkId, body, transactionId);
    await fetchChainAndRefresh();
  }

  async function doDeleteConfirmed(linkId: string) {
    if (!chain) return;
    setConfirmingDeleteId(null);
    const res = await fetch(`/api/chains/${chain.id}/links/${linkId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchChainAndRefresh();
    } else {
      toast.error("Couldn't remove this sale");
    }
  }

  async function handleBulkInvite() {
    if (!chain) return;
    const invitable = chain.links.filter(
      (l) =>
        l.transactionId === null &&
        l.stubAgentEmail &&
        l.inviteStatus === "NOT_SENT" &&
        l.createdByUserId === currentUserId,
    );
    setSendingInvites("bulk");
    let sent = 0;
    for (const link of invitable) {
      const res = await fetch(`/api/chains/${chain.id}/links/${link.id}/invite`, {
        method: "POST",
      });
      if (res.ok) sent++;
    }
    toast.success(`${sent} invite${sent !== 1 ? "s" : ""} sent`);
    setSendingInvites(null);
    await fetchChainAndRefresh();
  }

  async function handleCreateChain() {
    const res = await fetch("/api/chains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    if (res.ok) {
      await fetchChainAndRefresh();
    }
  }

  const invitablePending = chain?.links.filter(
    (l) =>
      l.transactionId === null &&
      l.stubAgentEmail &&
      l.inviteStatus === "NOT_SENT" &&
      (l.createdByUserId === currentUserId || isInternal),
  ) ?? [];

  // Split the chain into the main SPINE (branchKey "") and any onward BRANCHES
  // (extra onward purchases forking above a sale). The spine renders as the
  // vertical ladder exactly as before; branches render grouped above their fork
  // node. See docs/active/chain-branching/00-spec.md.
  const allChainLinks = chain?.links ?? [];
  const links = allChainLinks.filter((l) => (l.branchKey ?? "") === "");
  const branchesByFork = new Map<string, ChainV2["links"]>();
  for (const l of allChainLinks) {
    if ((l.branchKey ?? "") !== "" && l.forkFromLinkId) {
      const arr = branchesByFork.get(l.forkFromLinkId) ?? [];
      arr.push(l);
      branchesByFork.set(l.forkFromLinkId, arr);
    }
  }
  const MAX_ONWARDS = 3;

  // Tree model for the fork render. Group every link by its branch ladder
  // (sorted top→bottom by position), so we can find "the sale directly above"
  // within any ladder and walk the chain as a tree from the spine bottom up.
  const linksByBranch = new Map<string, ChainV2["links"]>();
  for (const l of allChainLinks) {
    const bk = l.branchKey ?? "";
    const arr = linksByBranch.get(bk);
    if (arr) arr.push(l);
    else linksByBranch.set(bk, [l]);
  }
  for (const arr of linksByBranch.values()) arr.sort((a, b) => a.position - b.position);
  const spineLadder = linksByBranch.get("") ?? [];
  const spineBottom = spineLadder.length > 0 ? spineLadder[spineLadder.length - 1] : null;
  // The onward purchases directly above a sale = the next sale up its own ladder
  // (position − 1) plus any branches forking from it. 2+ ⇒ a fork (V / trident).
  const onwardsAbove = (link: ChainV2["links"][number]): ChainV2["links"] => {
    const ladder = linksByBranch.get(link.branchKey ?? "") ?? [];
    const idx = ladder.findIndex((l) => l.id === link.id);
    const up = idx > 0 ? ladder[idx - 1] : null;
    const forks = branchesByFork.get(link.id) ?? [];
    return [up, ...forks].filter(Boolean) as ChainV2["links"];
  };
  const bottomLink = links[links.length - 1] ?? null;

  // Widest fan-out anywhere in the chain: 1 = a linear ladder, 2 = a V split,
  // 3 = a trident. Drives the drawer width so side-by-side onward columns never
  // bunch up — the more branches from one sale, the wider the drawer, up to
  // almost full width for a trident.
  const maxFanout = allChainLinks.reduce((m, l) => Math.max(m, onwardsAbove(l).length), 1);

  // Move up/down is offered only while the chain is entirely the creator's own
  // unclaimed stubs — the initial agent can fix the order before others join,
  // and it locks the moment one other sale is claimed.
  const canReorder =
    links.length >= 2 &&
    allChainLinks.every(
      (l) => l.createdByUserId === currentUserId && (l.claimedByUserId == null || l.claimedByUserId === currentUserId),
    );

  async function handleMove(linkId: string, direction: "up" | "down") {
    if (!chain) return;
    const res = await fetch(`/api/chains/${chain.id}/links/${linkId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (res.ok) await fetchChainAndRefresh();
    else toast.error("Couldn't move this sale");
  }

  const userLink = links.find(
    (l) => l.claimedByUserId === currentUserId || l.createdByUserId === currentUserId,
  ) ?? null;

  // Map nodes + moves — the spine (main chain line) turned into geographic data.
  // A node per link (numbered bottom=1 like the cards); a move per consecutive
  // pair (the household in the lower property is buying the one above). Memoised
  // on the chain so the map doesn't re-geocode on every render.
  const { mapNodes, mapMoves, mapDetails, orderedPanelLinks } = useMemo(() => {
    type Link = ChainV2["links"][number];
    const all: Link[] = chain?.links ?? [];
    const spine = all.filter((l) => (l.branchKey ?? "") === "").sort((a, b) => a.position - b.position);
    const spineTotal = spine.length;

    const nodeStatus = (l: Link): ChainMapStatus => {
      if (l.claimedByUserId === currentUserId || l.transactionId === transactionId) return "yours";
      if (l.transaction?.status === "completed") return "completed";
      if (l.transactionId != null) return "claimed";
      if (l.inviteStatus === "SENT" || l.inviteStatus === "BOUNCED") return "invited";
      return "unclaimed";
    };
    const addr = (l: Link) => l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "";
    const isSpine = (l: Link) => (l.branchKey ?? "") === "";
    const labelOf = (l: Link) => (isSpine(l) ? String(displayChainPosition(l.position, spineTotal)) : "↑");

    // Nodes = every link (spine + onward-purchase branches). Onward pins are
    // marked so they read as branches, not spine positions.
    const nodes: ChainMapNode[] = all.map((l) => ({
      id: l.id, label: labelOf(l), onward: !isSpine(l), address: addr(l), status: nodeStatus(l),
    }));

    // Moves = the real tree. Within each ladder (spine or a branch) consecutive
    // links are a move; each branch's bottom link forks from a spine node
    // (forkFromLinkId) — the spine seller buying that onward purchase.
    const moves: ChainMapMove[] = [];
    const ladders = new Map<string, Link[]>();
    for (const l of all) {
      const k = l.branchKey ?? "";
      (ladders.get(k) ?? ladders.set(k, []).get(k)!).push(l);
    }
    for (const group of ladders.values()) {
      const s = [...group].sort((a, b) => a.position - b.position);
      for (let i = 0; i < s.length - 1; i++) moves.push({ fromId: s[i].id, toId: s[i + 1].id });
    }
    for (const l of all) {
      if (l.forkFromLinkId) moves.push({ fromId: l.forkFromLinkId, toId: l.id, fork: true });
    }

    // Panel order = the chain as a TREE, walked from the spine bottom up so every
    // sale's onward purchases sit above it. A sale's FIRST onward stays in its own
    // ladder (the trunk, same depth); its 2nd/3rd onwards are branches that indent
    // one level (depth+1) with a rail. A branch can fork again → indents further.
    // depth 0 = the spine. branchTop = top of its own ladder (offer "+ add above").
    // hasLadderUp = there's a sale directly above in the same ladder (insertable).
    const byBranch = new Map<string, Link[]>();
    for (const l of all) { const k = l.branchKey ?? ""; (byBranch.get(k) ?? byBranch.set(k, []).get(k)!).push(l); }
    for (const arr of byBranch.values()) arr.sort((a, b) => a.position - b.position);
    // Branch legs forking off a node, keyed by that node. Only the branch BOTTOM
    // carries forkFromLinkId, so this is one entry per branch. Stable order.
    const forkChildren = new Map<string, Link[]>();
    for (const l of all) {
      if ((l.branchKey ?? "") !== "" && l.forkFromLinkId) {
        (forkChildren.get(l.forkFromLinkId) ?? forkChildren.set(l.forkFromLinkId, []).get(l.forkFromLinkId)!).push(l);
      }
    }
    for (const arr of forkChildren.values()) arr.sort((a, b) => a.position - b.position);

    const orderedPanelLinks: { link: Link; depth: number; branchTop: boolean; hasLadderUp: boolean; forkParent: boolean }[] = [];
    const walk = (link: Link, depth: number) => {
      const ladder = byBranch.get(link.branchKey ?? "") ?? [];
      const idx = ladder.findIndex((l) => l.id === link.id);
      const up = idx > 0 ? ladder[idx - 1] : null; // the sale directly above in this ladder
      const forks = forkChildren.get(link.id) ?? []; // extra onward purchases (branches)
      if (up) walk(up, depth);                       // continue the ladder upward first (trunk)
      for (const f of forks) walk(f, depth + 1);     // then each branch, indented
      // forkParent = this sale has branch onwards above it, so the rail should
      // curve down into it (it's where those branches fork from).
      orderedPanelLinks.push({ link, depth, branchTop: !up, hasLadderUp: !!up, forkParent: forks.length > 0 });
    };
    const spineBottomLink = spine[spine.length - 1];
    if (spineBottomLink) walk(spineBottomLink, 0);

    // Per-node detail (keyed) for the floating property + move cards.
    const detailById: Record<string, ChainMapDetail> = {};
    for (const l of all) {
      const a = addr(l);
      const ci = a.indexOf(",");
      const isYours = l.claimedByUserId === currentUserId || l.transactionId === transactionId;
      detailById[l.id] = {
        label: labelOf(l),
        line1: ci === -1 ? a : a.slice(0, ci),
        line2: ci === -1 ? "" : a.slice(ci + 1).trim(),
        agency: l.claimedBy?.firmName ?? l.stubAgencyName ?? null,
        photoUrl: l.photoUrl ?? l.transaction?.photoUrl ?? null,
        status: nodeStatus(l),
        progressPercent: l.progressPercent,
        href: l.transactionId && isYours ? `/agent/transactions/${l.transactionId}` : null,
      };
    }

    return { mapNodes: nodes, mapMoves: moves, mapDetails: detailById, orderedPanelLinks };
  }, [chain, currentUserId, transactionId]);

  // Chase-neighbour: the stub agent on the link directly above (onward) or below
  // (related) OUR OWN file — the inbound twin of the far-side tracker. Gated to a
  // stub with an email we can see, in our own ladder. Opens ChaseNeighbourDrawer.
  const ownChainLink = allChainLinks.find((l) => l.transactionId === transactionId) ?? null;
  const chaseDirForLink = (link: ChainV2["links"][number]): NeighbourChaseDirection | null => {
    if (!ownChainLink) return null;
    if ((link.branchKey ?? "") !== (ownChainLink.branchKey ?? "")) return null;
    if (link.transactionId !== null || !link.stubAgentEmail) return null; // stub with an email only
    if (link.position === ownChainLink.position - 1) return "onward";
    if (link.position === ownChainLink.position + 1) return "related";
    return null;
  };
  const [chaseNeighbour, setChaseNeighbour] = useState<{ direction: NeighbourChaseDirection; address: string | null } | null>(null);

  // Panel rows with per-row capabilities (edit / remove / reorder / chase /
  // add-onward / photo), using the same gating the Timeline's LinkCard uses.
  // Kept out of the map memo so this render-time gating doesn't churn map data.
  const panelItems: ChainMapPanelItem[] = orderedPanelLinks.map(({ link: l, depth, branchTop, hasLadderUp, forkParent }) => {
    const a = l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "";
    const ci = a.indexOf(",");
    const mine = l.claimedByUserId === currentUserId || l.transactionId === transactionId;
    const isSpineLink = (l.branchKey ?? "") === "";
    const spineIdx = links.findIndex((x) => x.id === l.id);
    const canEdit = l.canEditStub ?? canEditLink(l, currentUserId, currentUserRole);
    // Exact same status the Timeline LinkCard derives — drives both the label and
    // the primary CTA, so the panel never diverges from the Timeline.
    const st = getChainLinkStatus(
      { transactionId: l.transactionId, claimedByUserId: l.claimedByUserId, stubAgentEmail: l.stubAgentEmail, inviteStatus: l.inviteStatus ?? "NOT_SENT" },
      currentUserId,
    );
    const statusDanger = st.kind === "bounced" || st.kind === "declined";
    // 5-state colour for the numbered map pin (bounced/declined fall back to
    // unclaimed grey on the map; the row itself flags them in danger).
    const status: ChainMapStatus =
      mine ? "yours"
        : l.transaction?.status === "completed" ? "completed"
          : l.transactionId != null ? "claimed"
            : st.kind === "invited" ? "invited"
              : "unclaimed";
    // Primary CTA — identical wording/gating to the Timeline LinkCard.
    let cta: ChainMapCta | null = null;
    if (canEdit) {
      if (st.kind === "unclaimed_no_email") cta = { label: "Add email to invite", kind: "edit", tone: "primary" };
      else if (st.kind === "unclaimed_unsent") cta = { label: "Send invite", kind: "invite", tone: "primary" };
      else if (st.kind === "invited") cta = { label: "Resend invite", kind: "invite", tone: "normal" };
      else if (st.kind === "bounced") cta = { label: "Update email & resend", kind: "edit", tone: "warn" };
      else if (st.kind === "declined") cta = { label: "Resend", kind: "invite", tone: "primary" };
    }
    return {
      id: l.id,
      label: isSpineLink ? String(displayChainPosition(l.position, links.length)) : "↑",
      depth,
      forkParent,
      branchTop,
      // A branch column's top can grow upward (its own "+ add above"), just like
      // each column in the Timeline. The spine top is depth-0 branchTop and uses
      // the same control, so there's one add-above per column and no duplicate.
      canColumnAdd: branchTop && (isInternal || canAddAbove(l, currentUserId, currentUserRole)),
      line1: ci === -1 ? a : a.slice(0, ci),
      line2: ci === -1 ? "" : a.slice(ci + 1).trim(),
      agency: l.claimedBy?.firmName ?? l.stubAgencyName ?? null,
      photoUrl: l.photoUrl ?? l.transaction?.photoUrl ?? null,
      status,
      statusLabel: chainLinkStatusLabel(st),
      statusDanger,
      // Signals ported from the Timeline card (parity for the drawer swap).
      claimedByName: st.kind === "claimed_other" ? (l.claimedBy?.name ?? null) : null,
      priceLabel: mine && l.transaction ? (l.transaction.purchasePrice != null ? formatChainPriceFull(l.transaction.purchasePrice) : "Price TBC") : null,
      metaLine: [chainStatusMeta(l, currentUserId), chainChasedMeta(l)].filter(Boolean).join(" · ") || null,
      badges: chainWithdrawalBadges(l, directional[l.id]),
      progressPercent: l.progressPercent,
      href: l.transactionId && mine ? `/agent/transactions/${l.transactionId}` : null,
      cta,
      canEdit,
      hasShareLink: !!l.hasShareLink,
      canMoveUp: isSpineLink && canReorder && spineIdx > 0,
      canMoveDown: isSpineLink && canReorder && spineIdx >= 0 && spineIdx < links.length - 1,
      canAddOnward: (isInternal || canAddAbove(l, currentUserId, currentUserRole)) && onwardsAbove(l).length < MAX_ONWARDS,
      canUploadPhoto: l.transactionId == null && canEdit,
      chaseDir: chaseDirForLink(l),
      expand: isChainCardExpandable(l) ? <ChainCardExpand link={l} onSaveIntel={handleSaveIntel} onAddEntry={handleAddEntry} /> : null,
      // Hover "+" in the gap ABOVE this card: only where there's a sale directly
      // above in the SAME ladder (a real adjacent pair — a fork boundary isn't an
      // insertion point). Anchors to this (lower) card, placement "above".
      canInsertAbove: hasLadderUp && (isInternal || canAddAbove(l, currentUserId, currentUserRole)),
    };
  });

  // The ⋯-menu / photo handlers for the compact Map panel — the same ones the
  // Timeline's LinkCard uses, resolved from the link id the panel hands back.
  const mapPanelActions: ChainMapActions = {
    onEdit: (id) => {
      const l = allChainLinks.find((x) => x.id === id);
      if (l && onOpenAddNode && chain) onOpenAddNode("above", chain.id, l);
    },
    onEditEmail: (id) => {
      // The Add email / Update email & resend CTA — open Edit and land on the
      // agent-email field so the user doesn't hunt for it.
      const l = allChainLinks.find((x) => x.id === id);
      if (l && onOpenAddNode && chain) onOpenAddNode("above", chain.id, l, undefined, undefined, undefined, "agentEmail");
    },
    onAddOnward: (id) => { if (onOpenAddNode && chain) onOpenAddNode("above", chain.id, undefined, id); },
    // Grow a column upward — add a sale at the top of this link's own ladder
    // (spine or a branch), via the aboveOfLinkId add path.
    onColumnAdd: (id) => { if (onOpenAddNode && chain) onOpenAddNode("above", chain.id, undefined, undefined, id); },
    onInsert: (id, placement) => { if (onOpenAddNode && chain) onOpenAddNode("above", chain.id, undefined, undefined, undefined, { anchorLinkId: id, placement }); },
    onMoveUp: (id) => { void handleMove(id, "up"); },
    onMoveDown: (id) => { void handleMove(id, "down"); },
    onChase: (id) => {
      const l = allChainLinks.find((x) => x.id === id);
      const dir = l ? chaseDirForLink(l) : null;
      if (l && dir) setChaseNeighbour({ direction: dir, address: l.stubPropertyAddress ?? null });
    },
    onUploadPhoto: (id, file) => { void handleUploadPhoto(id, file); },
    onCopyShare: (id) => { void handleCopyShareLink(id); },
    onRevokeShare: (id) => { void handleRevokeShareLink(id); },
    onRemove: (id) => {
      const l = allChainLinks.find((x) => x.id === id);
      const label = l?.stubPropertyAddress ?? l?.transaction?.propertyAddress ?? "this sale";
      if (typeof window !== "undefined" && window.confirm(`Remove ${label} from the chain?`)) {
        void doDeleteConfirmed(id);
      }
    },
  };

  // Internal staff own no link on an outsourced file, so they can't anchor an
  // add on "their" link — allow them to add at the chain's bottom directly.
  // ("Add above" now lives at the top of each column in renderNode.)
  const showAddBelow =
    !!onOpenAddNode &&
    (isInternal
      ? !!bottomLink
      : !!userLink &&
        canAddBelow(userLink, currentUserId, currentUserRole) &&
        (bottomLink === null || bottomLink.id === userLink.id || bottomLink.transactionId === null));

  // Renders one link (the inline delete-confirm row, or the card). Shared by the
  // spine list and the branch groups so both behave identically. chainId is
  // passed in because `chain` is only narrowed to non-null inside the JSX below.
  const renderChainLink = (
    link: ChainV2["links"][number],
    chainId: string,
    opts: { edge?: "top" | "bottom"; totalLinks: number; positionLabel?: string; onMoveUp?: () => void; onMoveDown?: () => void; onAddOnward?: () => void },
  ) => {
    const mayEditStub = link.canEditStub ?? canEditLink(link, currentUserId, currentUserRole);
    if (confirmingDeleteId === link.id) {
      return (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
          background: "var(--agent-surface-elevated)",
          border: "1px solid var(--agent-danger-border)", borderRadius: 14,
          boxShadow: "var(--agent-glass-shadow)",
        }}>
          <p style={{ flex: 1, margin: 0, fontSize: 13, color: "var(--agent-text-primary)" }}>
            Remove this sale from the chain?
          </p>
          <button
            onClick={() => { void doDeleteConfirmed(link.id); }}
            className="chain-act-link"
            style={{ color: "var(--agent-danger)", fontWeight: 600 }}
          >
            Remove
          </button>
          <button onClick={() => setConfirmingDeleteId(null)} className="chain-act-link">
            Cancel
          </button>
        </div>
      );
    }
    return (
      <LinkCard
        link={link}
        totalLinks={opts.totalLinks}
        positionLabelOverride={opts.positionLabel}
        currentUserId={currentUserId}
        edge={opts.edge}
        directional={directional[link.id]}
        isYourFile={
          link.claimedByUserId === currentUserId ||
          (link.transactionId !== null && link.createdByUserId === currentUserId)
        }
        onResendInvite={
          mayEditStub && !!link.stubAgentEmail
            ? (id) => { void handleResendInvite(id); }
            : undefined
        }
        onEditStub={mayEditStub ? (l) => { onOpenAddNode?.("above", chainId, l); } : undefined}
        onDeleteStub={mayEditStub ? (id) => setConfirmingDeleteId(id) : undefined}
        onCopyShareLink={
          mayEditStub
            ? (id) => { void handleCopyShareLink(id); }
            : undefined
        }
        onRevokeShareLink={
          mayEditStub
            ? (id) => { void handleRevokeShareLink(id); }
            : undefined
        }
        onSaveIntel={handleSaveIntel}
        onAddEntry={handleAddEntry}
        onMoveUp={opts.onMoveUp}
        onMoveDown={opts.onMoveDown}
        onAddOnward={opts.onAddOnward}
        onChaseNeighbour={
          (() => {
            const dir = chaseDirForLink(link);
            return dir
              ? () => setChaseNeighbour({ direction: dir, address: link.stubPropertyAddress ?? null })
              : undefined;
          })()
        }
        onUploadPhoto={
          mayEditStub
            ? (id, file) => handleUploadPhoto(id, file)
            : undefined
        }
      />
    );
  };

  // Recursive tree render: a sale with its onward purchase(s) above it.
  //   0 onwards → just the card (top of a line)
  //   1 onward  → linear: onward stacked above + connector + card
  //   2-3       → a fork: the onward columns side by side, a fanning connector,
  //               then the card. Nested forks fall out because each column is
  //               itself a renderNode. Walk starts at the spine bottom.
  const renderNode = (link: ChainV2["links"][number], chainId: string): React.ReactNode => {
    const onwards = onwardsAbove(link);
    const isSpine = (link.branchKey ?? "") === "";
    const spineIdx = isSpine ? links.findIndex((l) => l.id === link.id) : -1;
    const canAddBranch =
      onwards.length >= 1 &&
      onwards.length < MAX_ONWARDS &&
      (isInternal || canAddAbove(link, currentUserId, currentUserRole));

    const card = (
      <div className={newLinkIds.has(link.id) ? "agent-reveal-in" : undefined}>
        {renderChainLink(link, chainId, {
          totalLinks: isSpine ? links.length : 1,
          positionLabel: isSpine ? undefined : "Onward purchase",
          edge:
            link.id === spineBottom?.id
              ? "bottom"
              : isSpine && onwards.length === 0
                ? "top"
                : undefined,
          onMoveUp: isSpine && canReorder && spineIdx > 0 ? () => { void handleMove(link.id, "up"); } : undefined,
          onMoveDown: isSpine && canReorder && spineIdx >= 0 && spineIdx < links.length - 1 ? () => { void handleMove(link.id, "down"); } : undefined,
          onAddOnward: canAddBranch ? () => onOpenAddNode?.("above", chainId, undefined, link.id) : undefined,
        })}
      </div>
    );

    if (onwards.length === 0) {
      // A bare column top (spine or branch): offer "Add sale above" here so each
      // column grows upward independently. Gated per-link — you can only add
      // above a sale you originated or claimed (internal staff always may).
      const canAddTop =
        !!onOpenAddNode &&
        (isInternal || canAddAbove(link, currentUserId, currentUserRole));
      return (
        <div key={link.id}>
          {canAddTop && (
            <button
              onClick={() => onOpenAddNode?.("above", chainId, undefined, undefined, link.id)}
              className="chain-addbtn chain-addbtn-above"
            >
              + Add sale above
            </button>
          )}
          {card}
        </div>
      );
    }
    if (onwards.length === 1) {
      // Offer insert-between only when the single onward is the sale stacked
      // directly above in the SAME ladder (a true adjacent pair). When it's a
      // fork (a different branch), "between" is ambiguous — the connector there
      // is a fork relationship, not an insertion point.
      const upperInSameLadder = (onwards[0].branchKey ?? "") === (link.branchKey ?? "");
      const canInsertHere =
        !!onOpenAddNode &&
        (isInternal || canAddAbove(link, currentUserId, currentUserRole));
      return (
        <div key={link.id}>
          {renderNode(onwards[0], chainId)}
          <ChainConnector
            onInsert={
              canInsertHere && upperInSameLadder
                ? () => onOpenAddNode?.("above", chainId, undefined, undefined, undefined, { anchorLinkId: link.id, placement: "above" })
                : undefined
            }
          />
          {card}
        </div>
      );
    }
    return (
      // data-fanout drives the container-query stacking thresholds in
      // globals.css — a trident needs more room than a V before it stacks.
      <div key={link.id} className="chain-fork" data-fanout={onwards.length}>
        <div className="chain-fork-cols">
          {onwards.map((o) => (
            <div key={o.id} className="chain-fork-col">
              {renderNode(o, chainId)}
            </div>
          ))}
        </div>
        <ForkConnector
          count={onwards.length}
          legs={onwards.map((o) => ({ onwardId: o.id }))}
          onInsert={
            !!onOpenAddNode && (isInternal || canAddAbove(link, currentUserId, currentUserRole))
              ? (anchorOnwardId) => onOpenAddNode?.("above", chainId, undefined, undefined, undefined, { anchorLinkId: anchorOnwardId, placement: "below" })
              : undefined
          }
        />
        {card}
      </div>
    );
  };

  const isMap = view === "map";
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Drawer swap: the compact card is now the Timeline (and the property-file chain
  // tab) too, not just the Map panel. The old LinkCard column tree is kept below
  // behind this flag — flip to false to restore it. (Remove once confirmed.)
  const USE_COMPACT_TIMELINE = true;
  const chainPanel = (
    <ChainMapPanel
      items={panelItems}
      selectedId={selectedNodeId}
      onSelect={setSelectedNodeId}
      onInvite={(id) => { void handleResendInvite(id); }}
      onAddBelow={onOpenAddNode && chain ? () => onOpenAddNode("below", chain.id) : undefined}
      busyInviteId={sendingInvites}
      actions={mapPanelActions}
    />
  );

  const shell = (
    <div
      // A dialog only in drawer mode; inline it's a page tab panel, not a modal.
      role={inline ? undefined : "dialog"}
      aria-label={inline ? undefined : "Chain"}
      className={inline ? "chain-view-inline flex flex-col" : isMap ? `relative z-10 flex flex-col h-full chain-cc-panel${sheetOpen ? " open" : ""}` : "relative z-10 flex flex-col h-full resp-drawer-wide"}
      style={
        inline
          ? undefined
          : isMap
          ? {
              // Map mode: the drawer becomes a compact left panel docked against
              // the nav, with the map filling the space to its right. minWidth:0 +
              // overflow:hidden stop the panel's content from pushing it wider
              // than 400px and squeezing the map pane to nothing.
              width: "min(400px, 46vw)", flexShrink: 0, flexGrow: 0, minWidth: 0, overflow: "hidden", height: "100%",
              background: "var(--agent-surface-elevated)",
              borderRight: "0.5px solid var(--agent-border-default)",
              boxShadow: "4px 0 24px rgba(0,0,0,0.10)",
              animation: reduceMotion ? undefined : "chain-panel-in 300ms cubic-bezier(0.25,0,0,1) both",
            }
          : {
              // Scale with the widest fork so columns never bunch: linear stays
              // narrow, a V split gets more room, a trident opens almost full width.
              // calc(100vw - 48px) caps guarantee a ≥48px backdrop dismiss gutter;
              // .resp-drawer-wide commits to full-screen below 900 (audit E2 —
              // the old 96vw/100vw left an 8px strip at 768).
              // Compact timeline needs no fork-column room — a single, comfortable
              // width. (Old fan-out-scaled width kept for the flag's false branch.)
              width: USE_COMPACT_TIMELINE
                ? "min(600px, calc(100vw - 48px))"
                : maxFanout >= 3 ? "min(1440px, calc(100vw - 48px))" : maxFanout === 2 ? "min(1120px, calc(100vw - 48px))" : "min(760px, calc(100vw - 48px))",
              transition: "width 260ms cubic-bezier(0.25,0,0,1)",
              background: "var(--agent-surface-elevated)",
              borderLeft: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
              animation: closing
                ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
                : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
            }
      }
    >
      {/* Mobile bottom-sheet grab handle (hidden on desktop via CSS). */}
      {isMap && (
        <button
          type="button"
          className="chain-sheet-handle"
          onClick={() => setSheetOpen((o) => !o)}
          aria-label={sheetOpen ? "Collapse chain list" : "Expand chain list"}
        >
          <span />
        </button>
      )}

      {/* Header — drawer chrome only; the property-file tab has its own heading. */}
      {!inline && (
        <div style={{ ...SHEET_BAND_STYLE, display: "flex", alignItems: "center", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SheetBandHeader
              title={chain?.name?.trim() || "Chain"}
              subtitle={
                allChainLinks.length > 0
                  ? allChainLinks.length > links.length
                    ? `${allChainLinks.length} linked sales, including ${allChainLinks.length - links.length} onward ${allChainLinks.length - links.length === 1 ? "purchase" : "purchases"}.`
                    : `${links.length} linked ${links.length === 1 ? "sale" : "sales"}, top to bottom. When one moves, everything below moves with it.`
                  : "Every linked sale, in one place"
              }
            />
          </div>
          <button
            onClick={doClose}
            aria-label="Close"
            className="agent-icon-btn agent-icon-btn-sm"
            style={{ color: "rgba(255,255,255,0.85)", background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {/* Timeline | Map | Activity view switch */}
      <div
        className={`chain-viewswitch${inline ? " chain-viewswitch--inline" : ""}`}
        style={{ "--vs-idx": view === "timeline" ? 0 : view === "map" ? 1 : 2 } as React.CSSProperties}
      >
        <button type="button" className={`chain-vs-btn${view === "timeline" ? " on" : ""}`} onClick={() => setView("timeline")}>Timeline</button>
        <button type="button" className={`chain-vs-btn${view === "map" ? " on" : ""}`} onClick={() => setView("map")}>Map</button>
        <button type="button" className={`chain-vs-btn${view === "activity" ? " on" : ""}`} onClick={() => setView("activity")}>Activity</button>
      </div>

      {/* Map mode: the compact ordered chain list. The full dashboard body below
          is kept mounted but hidden, so switching back to Timeline is instant. */}
      {isMap && (
        inline ? (
          // Inline tab: the map fills the full chain content width below the
          // switcher (its own rounded panel), pins carry selection — no side list.
          <div className="chain-inline-map">
            <ChainGeoMap
              nodes={mapNodes}
              moves={mapMoves}
              details={mapDetails}
              selectedId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              theme={isNight ? "dark" : "light"}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto cmp-scroll">
            {chainPanel}
          </div>
        )
      )}

        {/* Body */}
        <div className={`flex-1 overflow-y-auto py-5 ${inline ? "chain-body-inline" : "px-6"}`} style={isMap ? { display: "none" } : undefined}>
          {/* Skeleton loading state */}
          {loading && (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse px-4 py-3"
                  style={{
                    background: "var(--agent-surface-elevated)",
                    border: "1px solid var(--agent-border-default)",
                    borderRadius: 14,
                  }}
                >
                  <div className="h-3 rounded w-3/4 mb-2.5" style={{ background: "var(--agent-border-strong)" }} />
                  <div className="h-2 rounded w-1/2" style={{ background: "var(--agent-border-default)" }} />
                </div>
              ))}
            </div>
          )}

          {/* Chain exists but the viewer isn't a chain participant AND isn't
              internal staff. The API returns notAParticipant: true for this
              case so we render honest copy - "there IS a chain, you just
              can't see it" - instead of the misleading "No chain yet"
              empty state that would show a Create button and trap the user
              in a double-create error. */}
          {!loading && !chain && notAParticipant && (
            <EmptyState
              icon={<ChainIcon />}
              title="This file is in a chain"
              description="Only agents in the chain can see the details. Ask the person who added it if you need to see it."
            />
          )}

          {/* No chain linked — primary "build the chain" moment, given a
              larger hero treatment than the icon+EmptyState used elsewhere. */}
          {!loading && !chain && !notAParticipant && (
            <div className="flex flex-col items-center justify-center text-center px-6 py-16">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                Build this sale&rsquo;s chain
              </h3>
              <p className="text-sm text-slate-900/50 mt-2 max-w-sm leading-relaxed">
                Add the properties above and below this sale to see the full chain and keep track of progress across it.
              </p>
              <button
                onClick={handleCreateChain}
                className="mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl agent-btn-color-primary transition-colors"
              >
                <Plus weight="bold" className="w-4 h-4" />
                Create chain
              </button>
              <p className="text-xs text-slate-900/35 mt-4">
                You can add or change links at any time.
              </p>
            </div>
          )}

          {/* Chain exists but no links yet */}
          {!loading && chain && links.length === 0 && (
            <EmptyState
              icon={<ChainIcon />}
              title="Chain started"
              description="Add the sale above or below this one to start tracking together."
              action={
                onOpenAddNode ? (
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => onOpenAddNode("above", chain.id)}
                      className="px-4 py-2 text-sm font-medium rounded-xl agent-btn-color-primary transition-colors"
                    >
                      + Add sale above
                    </button>
                    <button
                      onClick={() => onOpenAddNode("below", chain.id)}
                      className="px-4 py-2 text-sm font-medium rounded-xl border border-white/50 bg-white/30 hover:bg-white/60 text-slate-900/70 transition-all"
                    >
                      + Add sale below
                    </button>
                  </div>
                ) : undefined
              }
            />
          )}

          {/* Populated chain */}
          {!loading && chain && links.length > 0 && (
            <div className="chain-dbody chain-dbody--stack">
              {view === "activity" ? (
              <div className="chain-stack chain-stack--gap">
                <ChainSummaryCard chain={chain} />
                <ChainActivityCard chainId={chain.id} refreshKey={refreshKey + activityTick} />
              </div>
              ) : (<>
              <div className="chain-stack">
              {/* Decline notification banner */}
              {declineNotification && !declineDismissed && (
                <div style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  background: "rgba(245,158,11,0.08)",
                  border: "0.5px solid rgba(245,158,11,0.25)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>ℹ</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "var(--agent-text-primary)", margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
                      An agent declined your invite
                    </p>
                    <p style={{ fontSize: 12, color: "var(--agent-text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>
                      {declineNotification.address} · Resend the invite to add them again.
                    </p>
                  </div>
                  <button
                    onClick={() => { void dismissDecline(); }}
                    aria-label="Dismiss"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1, color: "var(--agent-text-secondary)", padding: 0, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Cascade-notification respond cards — one per pending notification for this user.
                  Each card's button set depends on notification.type. */}
              {pendingNotifications.map((n) => {
                const prompt = n.type === "LOST_BUYER"
                  ? "The buyer for your client's property has pulled out of the chain. What would you like to do?"
                  : n.type === "LOST_PURCHASE"
                    ? "The property your client was buying has fallen through. What would you like to do?"
                    : "The onward chain is being re-formed. Is your client happy to wait?";

                const options: Array<{ status: "REMARKETING" | "WAITING" | "BREAK_CHAIN" | "WITHDRAW"; label: string }> =
                  n.type === "LOST_BUYER"
                    ? [
                        { status: "REMARKETING", label: "Find a new buyer" },
                        { status: "WITHDRAW",    label: "Withdraw too" },
                      ]
                    : n.type === "LOST_PURCHASE"
                      ? [
                          { status: "REMARKETING", label: "Find a new purchase" },
                          { status: "BREAK_CHAIN", label: "Proceed without onward purchase" },
                          { status: "WITHDRAW",    label: "Withdraw too" },
                        ]
                      : [
                          { status: "WAITING",  label: "Wait" },
                          { status: "WITHDRAW", label: "Withdraw" },
                        ];

                return (
                  <div key={n.id} style={{
                    marginBottom: 12,
                    padding: "12px 12px",
                    background: "rgba(99,102,241,0.06)",
                    border: "0.5px solid rgba(99,102,241,0.2)",
                    borderRadius: 8,
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", margin: "0 0 10px" }}>
                      {prompt}
                    </p>
                    {n.type === "ASKED_TO_WAIT" && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-secondary)", display: "block", marginBottom: 4 }}>
                          Come back to this on
                        </label>
                        <DateField
                          min={tomorrowDateStr()}
                          value={waitDateByNotif[n.id] ?? defaultWaitDateStr()}
                          onChange={(e) => setWaitDateByNotif((prev) => ({ ...prev, [n.id]: e.target.value }))}
                          style={{
                            fontSize: 12,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "0.5px solid var(--agent-border)",
                            background: "var(--agent-surface)",
                            color: "var(--agent-text-primary)",
                          }}
                          wrapperStyle={{ display: "inline-block" }}
                        />
                        <p style={{ fontSize: 11, color: "var(--agent-text-tertiary)", margin: "6px 0 0", lineHeight: 1.4 }}>
                          We&rsquo;ll pause this file and raise it on your hub on this date, so you can decide whether to keep waiting, go back to market, or withdraw.
                        </p>
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {options.map((opt) => {
                        const isSubmitting = submittingNotificationId === n.id;
                        return (
                          <button
                            key={opt.status}
                            onClick={() => {
                              const reviewDate = opt.status === "WAITING"
                                ? (waitDateByNotif[n.id] ?? defaultWaitDateStr())
                                : undefined;
                              void respondToNotification(n.id, opt.status, reviewDate);
                            }}
                            disabled={isSubmitting}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "none",
                              background: opt.status === "WITHDRAW" ? "#dc2626" : "#6366f1",
                              color: "#fff",
                              cursor: isSubmitting ? "not-allowed" : "pointer",
                              opacity: isSubmitting ? 0.5 : 1,
                            }}
                          >
                            {isSubmitting ? "Saving…" : opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {respondError && (
                <div style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "rgba(220,38,38,0.08)",
                  border: "0.5px solid rgba(220,38,38,0.2)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#991b1b",
                }}>
                  {respondError}
                </div>
              )}

              {/* Broken-chain banner — voice pass deferred */}
              {isChainBroken(chain) && (
                <div style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  background: "rgba(239,68,68,0.08)",
                  border: "0.5px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>⚠</span>
                  <p style={{ fontSize: 12, color: "var(--agent-danger)", margin: 0, lineHeight: 1.5 }}>
                    A sale in this chain has fallen through.
                  </p>
                </div>
              )}

              {/* Chain-split banner — closed-loop chain arc (2026-06-05).
                * Surfaces when a withdraw cascade detached part of the chain
                * into its own PropertyChain row. Direction reads "above" /
                * "below" the agent's perspective so it's obvious WHICH end
                * left — pre-arc agents couldn't tell their chain had been
                * shortened at all. */}
              {chain.detachedSegment && chain.detachedSegment.count > 0 && (
                <div style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  background: "rgba(245,158,11,0.08)",
                  border: "0.5px solid rgba(245,158,11,0.25)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}>
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>↯</span>
                  <p style={{ fontSize: 12, color: "rgb(146, 78, 4)", margin: 0, lineHeight: 1.5 }}>
                    <strong>Chain split.</strong>{" "}
                    {chain.detachedSegment.count} sale{chain.detachedSegment.count !== 1 ? "s" : ""}{" "}
                    {chain.detachedSegment.direction === "DOWNWARD"
                      ? "below"
                      : chain.detachedSegment.direction === "UPWARD"
                        ? "above"
                        : "in this chain"}{" "}
                    were separated when a sale here withdrew. They now stand as their own chain.
                  </p>
                </div>
              )}

              {/* Chain bottleneck banner — only when the chain is intact + a
               * meaningful gap (>7 days) exists between the slowest claimed
               * link and the median of the others. Relative comparison so it's
               * safe to surface even before MEDIANS_READY (every link uses the
               * same biased medians; the slowest is still the slowest). */}
              {(() => {
                if (isChainBroken(chain)) return null;
                const bottleneck = computeChainBottleneck(chain);
                if (!bottleneck) return null;
                const isYourFile = bottleneck.claimedByUserId === currentUserId;
                return (
                  <div style={{
                    marginBottom: 12,
                    padding: "10px 12px",
                    background: "rgba(245,158,11,0.08)",
                    border: "0.5px solid rgba(245,158,11,0.25)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>ℹ</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0, lineHeight: 1.5 }}>
                        One file is behind the chain
                      </p>
                      <p style={{ fontSize: 12, color: "var(--agent-text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>
                        {isYourFile
                          ? (bottleneck.stuckMilestoneLabel
                              ? `Your file is about ${bottleneck.daysBehind} days behind the rest of the chain. Hold-up: ${bottleneck.stuckMilestoneLabel}. Worth a push if you can.`
                              : `Your file is about ${bottleneck.daysBehind} days behind the rest of the chain. Worth a push if you can.`)
                          : `${bottleneck.address} is about ${bottleneck.daysBehind} days behind the rest of the chain. A nudge across the chain may help.`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {USE_COMPACT_TIMELINE ? (
                // The compact card tree — same component the Map view uses.
                <div className="cmp-scroll cmp-scroll--flush">{chainPanel}</div>
              ) : (<>
              {/* The chain as a tree: walk from the spine bottom up. A sale with
                  2-3 onward purchases renders them side by side (V / trident)
                  above it; linear runs stay a single column. "Add sale above"
                  now lives at the top of each column (see renderNode), so a
                  split can grow every branch independently. */}
              {spineBottom && renderNode(spineBottom, chain.id)}

              {/* Add below button */}
              {showAddBelow && (
                <button
                  onClick={() => onOpenAddNode?.("below", chain.id)}
                  className="chain-addbtn chain-addbtn-below"
                >
                  + Add sale below
                </button>
              )}
              </>)}
              </div>

              </>)}
            </div>
          )}
        </div>

        {/* Sticky footer: bulk invite — an inset rounded card that floats off the
            drawer edges rather than a flush square bar. */}
        {invitablePending.length > 0 && (
          <div
            className="flex-shrink-0 mx-4 mb-4 px-4 py-3 flex items-center justify-between rounded-[14px]"
            style={{ border: "1px solid var(--agent-border-default)", background: "var(--agent-glass-bg-subtle)", boxShadow: "var(--agent-glass-shadow)" }}
          >
            <p className="text-xs" style={{ color: "var(--agent-text-secondary)" }}>
              {invitablePending.length} agent{invitablePending.length !== 1 ? "s" : ""} ready to invite
            </p>
            <button
              onClick={() => { void handleBulkInvite(); }}
              disabled={sendingInvites !== null}
              className="px-3 py-1.5 text-xs font-medium rounded-lg agent-btn-color-primary disabled:opacity-50 transition-colors"
            >
              {sendingInvites === "bulk" ? "Sending…" : "Send invites"}
            </button>
          </div>
        )}
    </div>
  );

  const chaseNeighbourDrawer = chaseNeighbour ? (
    <ChaseNeighbourDrawer
      transactionId={transactionId}
      direction={chaseNeighbour.direction}
      neighbourAddress={chaseNeighbour.address}
      onClose={() => setChaseNeighbour(null)}
      onSent={() => setActivityTick((t) => t + 1)}
    />
  ) : null;

  // Inline (tab) mode: render the body flat, no portal / backdrop / scroll-lock.
  // The Map view lives inside the shell (below the switcher), so the switcher
  // never moves and stays reachable.
  if (inline) {
    return (
      <div data-theme={theme} data-night={isNight ? "" : undefined}>
        {shell}
        {chaseNeighbourDrawer}
      </div>
    );
  }

  // Drawer mode: timeline = right-hand slide-over; map = a docked command centre
  // (compact chain panel beside the nav, map filling the rest, nav still visible).
  return createPortal(
    <div data-theme={theme} data-night={isNight ? "" : undefined} className={`fixed inset-0${isMap ? "" : " flex justify-end"}${isNight ? " nv2-night" : ""}`} style={{ zIndex: 1000, pointerEvents: isMap ? "none" : undefined }}>
      {/* Backdrop — timeline only; map mode leaves the nav visible. */}
      {!isMap && <div className="fixed inset-0 agent-backdrop-overlay" onClick={doClose} />}
      {isMap ? (
        <div className="chain-cc">
          {shell}
          <div className="chain-cc-map">
            <ChainGeoMap
              nodes={mapNodes}
              moves={mapMoves}
              details={mapDetails}
              selectedId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              theme={isNight ? "dark" : "light"}
            />
          </div>
        </div>
      ) : (
        shell
      )}
      {chaseNeighbourDrawer}
    </div>,
    document.body,
  );
}

// Thin wrapper: the chain body as a right-hand slide-over. Used off the property
// file (the Chains workspace, via ViewChainButton). On the property file itself
// the chain lives on its own tab through ChainTabPanel (ChainView variant="inline").
export function ChainDrawer(props: Omit<ChainViewProps, "variant">) {
  return <ChainView {...props} variant="drawer" />;
}
