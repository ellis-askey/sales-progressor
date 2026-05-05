"use client";

import { useState } from "react";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import type { ChainLinkV2 } from "@/lib/services/chains";

type Props = {
  transactionId: string;
  currentUserId: string;
};

export function ViewChainButton({ transactionId, currentUserId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addNode, setAddNode] = useState<{
    direction: "above" | "below";
    chainId: string;
    editingLink?: ChainLinkV2;
  } | null>(null);

  function handleOpenAddNode(direction: "above" | "below", chainId: string, link?: ChainLinkV2) {
    setAddNode({ direction, chainId, editingLink: link });
  }

  function handleCloseAddNode() {
    setAddNode(null);
  }

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
      >
        View Chain
      </button>

      {drawerOpen && (
        <ChainDrawer
          transactionId={transactionId}
          currentUserId={currentUserId}
          onClose={() => setDrawerOpen(false)}
          onOpenAddNode={handleOpenAddNode}
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
