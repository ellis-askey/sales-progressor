"use client";

import { useState, useRef, useCallback } from "react";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import { useChainAddNode } from "@/components/chain/use-chain-add-node";
import { LinkArrow } from "@/components/ui/LinkArrow";
import type { ChainTabPayload } from "@/lib/services/chains";

type Props = {
  transactionId: string;
  currentUserId: string;
  currentUserRole?: string | null;
  declineNotification?: { address: string; at: string } | null;
  // Override the button label (default "Open chain"). The chains workspace uses
  // "Set up chain" on files that aren't in one yet.
  label?: string;
};

export function ViewChainButton({ transactionId, currentUserId, currentUserRole, declineNotification, label }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { addNode, openAddNode, closeAddNode, onNodeSaved, refreshKey } = useChainAddNode();

  // Warm the chain payload on hover / focus so the drawer opens with content
  // already in hand instead of a skeleton (the drawer seeds from initialChainData
  // exactly like the file-page inline tab, then reconciles silently on mount).
  // Idempotent; a click that beats the prefetch just falls back to the drawer's
  // own fetch. From the chains list the card only carries a summary, so the full
  // per-link payload genuinely has to be loaded — this loads it a beat early.
  const [prefetched, setPrefetched] = useState<ChainTabPayload | null>(null);
  const prefetchStarted = useRef(false);
  const prefetch = useCallback(() => {
    if (prefetchStarted.current) return;
    prefetchStarted.current = true;
    fetch(`/api/chains?transactionId=${transactionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setPrefetched(d as ChainTabPayload); })
      .catch(() => { prefetchStarted.current = false; }); // allow a later hover to retry
  }, [transactionId]);

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onTouchStart={prefetch}
        className="agent-link"
        style={{ fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 5 }}
      >
        {label ?? "Open chain"}
        <LinkArrow style={{ marginLeft: 0 }} />
      </button>

      {drawerOpen && (
        <ChainDrawer
          transactionId={transactionId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setDrawerOpen(false)}
          onOpenAddNode={openAddNode}
          declineNotification={declineNotification}
          refreshKey={refreshKey}
          initialChainData={prefetched}
        />
      )}

      {addNode && (
        <AddNodeDrawer
          chainId={addNode.chainId}
          transactionId={transactionId}
          direction={addNode.direction}
          editingLink={addNode.editingLink}
          forkFromLinkId={addNode.forkFromLinkId}
          aboveOfLinkId={addNode.aboveOfLinkId}
          insertBetween={addNode.insertBetween}
          focusField={addNode.focusField}
          onClose={closeAddNode}
          onSaved={onNodeSaved}
        />
      )}
    </>
  );
}
