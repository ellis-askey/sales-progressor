"use client";

import { useState } from "react";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import type { EditingLinkData } from "@/components/chain/AddNodeDrawer";

type Props = {
  transactionId: string;
  currentUserId: string;
  declineNotification?: { address: string; at: string } | null;
};

export function ViewChainButton({ transactionId, currentUserId, declineNotification }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addNode, setAddNode] = useState<{
    direction: "above" | "below";
    chainId: string;
    editingLink?: EditingLinkData;
  } | null>(null);

  function handleOpenAddNode(direction: "above" | "below", chainId: string, link?: EditingLinkData) {
    setAddNode({ direction, chainId, editingLink: link });
  }

  function handleCloseAddNode() {
    setAddNode(null);
  }

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="agent-link"
        style={{ fontSize: 11 }}
      >
        View Chain →
      </button>

      {drawerOpen && (
        <ChainDrawer
          transactionId={transactionId}
          currentUserId={currentUserId}
          onClose={() => setDrawerOpen(false)}
          onOpenAddNode={handleOpenAddNode}
          declineNotification={declineNotification}
        />
      )}

      {addNode && (
        <AddNodeDrawer
          chainId={addNode.chainId}
          transactionId={transactionId}
          direction={addNode.direction}
          editingLink={addNode.editingLink}
          onClose={handleCloseAddNode}
          onSaved={handleCloseAddNode}
        />
      )}
    </>
  );
}
