"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkCard, ChainConnector } from "@/components/chain/LinkCard";
import type { ChainV2 } from "@/lib/services/chains";
import type { EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { canAddAbove, canAddBelow, canViewChain } from "@/lib/chain/permissions";
import { useToast } from "@/components/ui/ToastContext";

type ChainDrawerProps = {
  transactionId: string;
  currentUserId: string;
  onClose: () => void;
  onOpenAddNode?: (direction: "above" | "below", chainId: string, editingLink?: EditingLinkData) => void;
};

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

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
}: ChainDrawerProps) {
  const [chain, setChain] = useState<ChainV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingInvites, setSendingInvites] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchChain = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chains?transactionId=${transactionId}`);
      const data = await res.json();
      setChain(data.chain ?? null);
    } catch {
      // Network error — show empty state
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    fetchChain();
  }, [fetchChain]);

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
        addToast("1 invite sent", "success");
        await fetchChain();
      } else {
        addToast("Failed to send invite", "error");
      }
    } finally {
      setSendingInvites(null);
    }
  }

  async function handleDeleteStub(linkId: string) {
    if (!chain) return;
    if (!confirm("Remove this sale from the chain?")) return;
    const res = await fetch(`/api/chains/${chain.id}/links/${linkId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchChain();
    } else {
      addToast("Failed to remove", "error");
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
    addToast(`${sent} invite${sent !== 1 ? "s" : ""} sent`, "success");
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
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        style={{ animation: "agent-backdrop-in 200ms ease both" }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Chain progress"
        className="relative z-10 w-full sm:max-w-[480px] flex flex-col h-full"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(32px) saturate(1.8)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8)",
          borderLeft: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.20)",
          animation: "agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/40 bg-white/20 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900/90">Chain progress</h2>
            <p className="text-xs text-slate-900/40 mt-0.5">
              Real-time visibility across every link in the chain
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/30 text-slate-900/40 transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-sm text-slate-900/30 text-center py-10">Loading chain…</p>
          )}

          {!loading && !chain && (
            <EmptyState
              icon={<ChainIcon />}
              title="No chain linked to this sale"
              description="Create a chain to track your sale's position and invite other agents to share progress visibility."
              action={
                <button
                  onClick={handleCreateChain}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  + Create chain
                </button>
              }
            />
          )}

          {!loading && chain && links.length === 0 && (
            <EmptyState
              icon={<ChainIcon />}
              title="No chain linked to this sale"
              description="Create a chain to track your sale's position and invite other agents to share progress visibility."
            />
          )}

          {!loading && chain && links.length > 0 && (
            <div className="space-y-0">
              {/* Add above button */}
              {showAddAbove && (
                <button
                  onClick={() => onOpenAddNode?.("above", chain.id)}
                  className="w-full text-xs text-slate-900/40 hover:text-blue-500 border border-dashed border-white/30 rounded-xl py-2 mb-3 transition-colors"
                >
                  + Add sale above
                </button>
              )}

              {/* Link cards */}
              {links.map((link, i) => (
                <div key={link.id}>
                  <LinkCard
                    link={link}
                    totalLinks={links.length}
                    currentUserId={currentUserId}
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
                        ? (id) => { void handleDeleteStub(id); }
                        : undefined
                    }
                  />
                  {i < links.length - 1 && <ChainConnector />}
                </div>
              ))}

              {/* Add below button */}
              {showAddBelow && (
                <button
                  onClick={() => onOpenAddNode?.("below", chain.id)}
                  className="w-full text-xs text-slate-900/40 hover:text-blue-500 border border-dashed border-white/30 rounded-xl py-2 mt-3 transition-colors"
                >
                  + Add sale below
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer: bulk invite */}
        {invitablePending.length > 0 && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-white/30 bg-white/20 flex items-center justify-between">
            <p className="text-xs text-slate-900/60">
              {invitablePending.length} node{invitablePending.length !== 1 ? "s" : ""} ready to invite
            </p>
            <button
              onClick={() => { void handleBulkInvite(); }}
              disabled={sendingInvites !== null}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
