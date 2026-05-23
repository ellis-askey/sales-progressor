"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkCard, ChainConnector } from "@/components/chain/LinkCard";
import type { ChainV2 } from "@/lib/services/chains";
import { isChainBroken } from "@/lib/chain/is-broken";
import { computeChainBottleneck } from "@/lib/chain/bottleneck";
import type { EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { canAddAbove, canAddBelow } from "@/lib/chain/permissions";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type ChainDrawerProps = {
  transactionId: string;
  currentUserId: string;
  onClose: () => void;
  onOpenAddNode?: (direction: "above" | "below", chainId: string, editingLink?: EditingLinkData) => void;
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

export function ChainDrawer({
  transactionId,
  currentUserId,
  onClose,
  onOpenAddNode,
  declineNotification,
  refreshKey = 0,
}: ChainDrawerProps) {
  const { theme } = usePortalTheme();
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
        setRespondError(body.error ?? "Couldn't save your response — please reload and try again.");
        return;
      }
      await fetchChain();
    } catch {
      setRespondError("Network error — please reload and try again.");
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
        toast.success("1 invite sent");
        await fetchChain();
      } else {
        toast.error("Couldn't send invite");
      }
    } finally {
      setSendingInvites(null);
    }
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
      l.createdByUserId === currentUserId,
  ) ?? [];

  const links = chain?.links ?? [];
  const topLink = links[0] ?? null;
  const bottomLink = links[links.length - 1] ?? null;

  const userLink = links.find(
    (l) => l.claimedByUserId === currentUserId || l.createdByUserId === currentUserId,
  ) ?? null;

  const showAddAbove =
    !!onOpenAddNode &&
    !!userLink &&
    canAddAbove(userLink, currentUserId) &&
    (topLink === null || topLink.id === userLink.id || topLink.transactionId === null);

  const showAddBelow =
    !!onOpenAddNode &&
    !!userLink &&
    canAddBelow(userLink, currentUserId) &&
    (bottomLink === null || bottomLink.id === userLink.id || bottomLink.transactionId === null);

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
          width: "min(440px, 100vw)",
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
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Chain</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-secondary)" }}>Every linked sale, in one place</p>
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
                <div key={i} className="animate-pulse rounded-xl bg-white/40 border border-white/30 px-4 py-3">
                  <div className="h-3 bg-slate-900/10 rounded w-3/4 mb-2.5" />
                  <div className="h-2 bg-slate-900/06 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* No chain linked */}
          {!loading && !chain && (
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
            <div className="space-y-0">
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
                    A sale in this chain has withdrawn.
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

              {/* Add above button */}
              {showAddAbove && (
                <button
                  onClick={() => onOpenAddNode?.("above", chain.id)}
                  className="w-full text-xs text-slate-900/40 agent-hover-link border border-dashed border-white/30 rounded-xl py-2 mb-3 transition-colors"
                >
                  + Add sale above
                </button>
              )}

              {/* Link cards */}
              {links.map((link, i) => (
                <div key={link.id} className={newLinkIds.has(link.id) ? "agent-reveal-in" : undefined}>
                  {confirmingDeleteId === link.id ? (
                    <div className="rounded-xl bg-white/40 border border-white/30 px-4 py-3 flex items-center gap-3">
                      <p className="flex-1 text-sm text-slate-900/70">Remove this sale from the chain?</p>
                      <button
                        onClick={() => { void doDeleteConfirmed(link.id); }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="text-xs agent-link-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <LinkCard
                      link={link}
                      totalLinks={links.length}
                      currentUserId={currentUserId}
                      directional={directional[link.id]}
                      isYourFile={
                        link.claimedByUserId === currentUserId ||
                        (link.transactionId !== null && link.createdByUserId === currentUserId)
                      }
                      onResendInvite={
                        link.createdByUserId === currentUserId && link.transactionId === null
                          ? (id) => { void handleResendInvite(id); }
                          : undefined
                      }
                      onEditStub={
                        link.createdByUserId === currentUserId && link.transactionId === null
                          ? (l) => { onOpenAddNode?.("above", chain.id, l); }
                          : undefined
                      }
                      onDeleteStub={
                        link.createdByUserId === currentUserId && link.transactionId === null
                          ? (id) => setConfirmingDeleteId(id)
                          : undefined
                      }
                    />
                  )}
                  {i < links.length - 1 && <ChainConnector />}
                </div>
              ))}

              {/* Add below button */}
              {showAddBelow && (
                <button
                  onClick={() => onOpenAddNode?.("below", chain.id)}
                  className="w-full text-xs text-slate-900/40 agent-hover-link border border-dashed border-white/30 rounded-xl py-2 mt-3 transition-colors"
                >
                  + Add sale below
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer: bulk invite */}
        {invitablePending.length > 0 && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-white/30 bg-white/20 flex items-center justify-between">
            <p className="text-xs text-slate-900/60">
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
