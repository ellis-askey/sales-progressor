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
  const [addNodeDirection, setAddNodeDirection] = useState<"above" | "below" | null>(null);
  const [editingLink, setEditingLink] = useState<ChainLinkV2 | undefined>(undefined);

  function handleOpenAddNode(direction: "above" | "below", link?: ChainLinkV2) {
    setAddNodeDirection(direction);
    setEditingLink(link);
  }

  function handleCloseAddNode() {
    setAddNodeDirection(null);
    setEditingLink(undefined);
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

      {addNodeDirection && (
        <AddNodeDrawer
          transactionId={transactionId}
          direction={addNodeDirection}
          editingLink={editingLink}
          onClose={handleCloseAddNode}
          onSaved={() => {
            handleCloseAddNode();
            // ChainDrawer will refetch on next open; nothing extra needed here
          }}
        />
      )}
    </>
  );
}
