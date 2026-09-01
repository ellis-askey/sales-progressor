"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkCard, ChainConnector } from "@/components/chain/LinkCard";
import { saveChainIntelAction } from "@/app/actions/chain-intel";
import type { ChainNodeIntelInput } from "@/lib/chain/intel";
import { ChainActivityCard } from "@/components/chain/ChainActivityCard";
import type { ChainV2 } from "@/lib/services/chains";
import { computeChainSummary, formatChainValueShort } from "@/lib/chain/summary";
import { isChainBroken } from "@/lib/chain/is-broken";
import { computeChainBottleneck } from "@/lib/chain/bottleneck";
import type { EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { canAddAbove, canAddBelow, canEditLink, isInternalStaff } from "@/lib/chain/permissions";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type ChainDrawerProps = {
  transactionId: string;
  currentUserId: string;
  // Session role — lets internal staff (admin / superadmin / sales_progressor)
  // edit chains on outsourced files they progress but didn't originate.
  currentUserRole?: string | null;
  onClose: () => void;
  // forkFromLinkId set => opening the drawer to add an EXTRA onward purchase (a
  // branch) forking above that sale, rather than a normal above/below stub.
  onOpenAddNode?: (
    direction: "above" | "below",
    chainId: string,
    editingLink?: EditingLinkData,
    forkFromLinkId?: string,
    aboveOfLinkId?: string,
  ) => void;
  declineNotification?: { address: string; at: string } | null;
  refreshKey?: number;
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
function ForkConnector({ count }: { count: number }) {
  const H = 26;
  return (
    <svg width="100%" height={H} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden style={{ display: "block", overflow: "visible" }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = ((i + 0.5) / count) * 100;
        return (
          <line key={i} x1={50} y1={H} x2={x} y2={0} stroke="var(--agent-border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        );
      })}
    </svg>
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

export function ChainDrawer({
  transactionId,
  currentUserId,
  currentUserRole,
  onClose,
  onOpenAddNode,
  declineNotification,
  refreshKey = 0,
}: ChainDrawerProps) {
  const { theme } = usePortalTheme();
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
  const [chain, setChain] = useState<ChainV2 | null>(null);
  const [notAParticipant, setNotAParticipant] = useState(false);
  const [loading, setLoading] = useState(true);
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

  async function dismissDecline() {
    setDeclineDismissed(true);
    await fetch("/api/chain/dismiss-decline", { method: "POST" }).catch(() => null);
  }

  async function respondToNotification(notificationId: string, status: "REMARKETING" | "WAITING" | "BREAK_CHAIN" | "WITHDRAW") {
    setSubmittingNotificationId(notificationId);
    setRespondError(null);
    try {
      const res = await fetch(`/api/chains/notifications/${notificationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRespondError(body.error ?? "Couldn't save your response. Please reload and try again.");
        return;
      }
      await fetchChain();
    } catch {
      setRespondError("Network error. Please reload and try again.");
    } finally {
      setSubmittingNotificationId(null);
    }
  }
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const { toast } = useAgentToast();

  const seenLinkIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const [newLinkIds, setNewLinkIds] = useState<Set<string>>(new Set());

  const fetchChain = useCallback(async () => {
    setLoading(true);
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

  useEffect(() => {
    fetchChain();
  }, [fetchChain, refreshKey]);

  // Clear the reveal flag after the 150ms animation has played out
  useEffect(() => {
    if (newLinkIds.size === 0) return;
    const t = setTimeout(() => setNewLinkIds(new Set()), 200);
    return () => clearTimeout(t);
  }, [newLinkIds]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        await fetchChain();
      } else {
        toast.error("Couldn't send invite");
      }
    } finally {
      setSendingInvites(null);
    }
  }

  async function handleSaveIntel(linkId: string, input: ChainNodeIntelInput) {
    // Server action re-checks edit permission (lib/chain/intel.ts); throws on
    // failure so LinkCard surfaces the inline error. Refetch to show saved values.
    await saveChainIntelAction(linkId, input);
    await fetchChain();
  }

  async function doDeleteConfirmed(linkId: string) {
    if (!chain) return;
    setConfirmingDeleteId(null);
    const res = await fetch(`/api/chains/${chain.id}/links/${linkId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchChain();
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
    await fetchChain();
  }

  async function handleCreateChain() {
    const res = await fetch("/api/chains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    if (res.ok) {
      await fetchChain();
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
  // Any fork present → the drawer widens so the side-by-side onward columns fit.
  const hasForks = branchesByFork.size > 0;
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
    if (res.ok) await fetchChain();
    else toast.error("Couldn't move this sale");
  }

  const userLink = links.find(
    (l) => l.claimedByUserId === currentUserId || l.createdByUserId === currentUserId,
  ) ?? null;

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
          canEditLink(link, currentUserId, currentUserRole) && !!link.stubAgentEmail
            ? (id) => { void handleResendInvite(id); }
            : undefined
        }
        onEditStub={mayEditStub ? (l) => { onOpenAddNode?.("above", chainId, l); } : undefined}
        onDeleteStub={mayEditStub ? (id) => setConfirmingDeleteId(id) : undefined}
        onSaveIntel={handleSaveIntel}
        onMoveUp={opts.onMoveUp}
        onMoveDown={opts.onMoveDown}
        onAddOnward={opts.onAddOnward}
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
      return (
        <div key={link.id}>
          {renderNode(onwards[0], chainId)}
          <ChainConnector />
          {card}
        </div>
      );
    }
    return (
      <div key={link.id} className="chain-fork">
        <div className="chain-fork-cols">
          {onwards.map((o) => (
            <div key={o.id} className="chain-fork-col">
              {renderNode(o, chainId)}
            </div>
          ))}
        </div>
        <ForkConnector count={onwards.length} />
        {card}
      </div>
    );
  };

  return createPortal(
    <div data-theme={theme} className="fixed inset-0 flex justify-end" style={{ zIndex: 1000 }}>
      {/* Backdrop */}
      <div className="fixed inset-0 agent-backdrop-overlay" onClick={doClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Chain"
        className="relative z-10 flex flex-col h-full"
        style={{
          width: `min(${hasForks ? 960 : 760}px, 100vw)`,
          transition: "width 260ms cubic-bezier(0.25,0,0,1)",
          background: "var(--agent-surface-elevated)",
          borderLeft: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.10)",
          animation: closing
            ? "agent-drawer-out 200ms cubic-bezier(0.25,0,0,1) forwards"
            : "agent-drawer-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              {chain?.name?.trim() || "Chain"}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-secondary)" }}>
              {links.length > 0
                ? `${links.length} linked ${links.length === 1 ? "sale" : "sales"}, top to bottom. When one moves, everything below moves with it.`
                : "Every linked sale, in one place"}
            </p>
          </div>
          <button onClick={doClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
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

          {/* No chain linked */}
          {!loading && !chain && !notAParticipant && (
            <EmptyState
              icon={<ChainIcon />}
              title="No chain yet"
              description="Create a chain to track your sale's position and invite other agents to share updates."
              action={
                <button
                  onClick={handleCreateChain}
                  className="px-4 py-2 text-sm font-medium rounded-xl agent-btn-color-primary transition-colors"
                >
                  + Create chain
                </button>
              }
            />
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
            <div className="chain-dbody">
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {options.map((opt) => {
                        const isSubmitting = submittingNotificationId === n.id;
                        return (
                          <button
                            key={opt.status}
                            onClick={() => { void respondToNotification(n.id, opt.status); }}
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
              </div>

              {/* Right column: value summary + activity feed */}
              <div className="chain-side">
                <ChainSummaryCard chain={chain} />
                <ChainActivityCard chainId={chain.id} refreshKey={refreshKey} />
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer: bulk invite */}
        {invitablePending.length > 0 && (
          <div
            className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--agent-border-subtle)", background: "var(--agent-glass-bg-subtle)" }}
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
    </div>,
    document.body,
  );
}
