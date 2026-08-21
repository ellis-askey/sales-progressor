"use client";

import { useState } from "react";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import type { AddNodeSavedResult, EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Props = {
  transactionId: string;
  currentUserId: string;
  currentUserRole?: string | null;
  declineNotification?: { address: string; at: string } | null;
};

export function ViewChainButton({ transactionId, currentUserId, currentUserRole, declineNotification }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addNode, setAddNode] = useState<{
    direction: "above" | "below";
    chainId: string;
    editingLink?: EditingLinkData;
  } | null>(null);
  const { toast } = useAgentToast();

  function handleOpenAddNode(direction: "above" | "below", chainId: string, link?: EditingLinkData) {
    setAddNode({ direction, chainId, editingLink: link });
  }

  function handleCloseAddNode() {
    setAddNode(null);
  }

  function handleNodeSaved(result?: AddNodeSavedResult) {
    setAddNode(null);
    setRefreshKey((k) => k + 1);
    if (!result) return;
    if (result.kind === "edited") {
      toast.success("Sale updated");
    } else {
      toast.success(result.inviteSent ? "Sale added · Invite sent" : "Sale added");
    }
  }

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="agent-link"
        style={{ fontSize: 11 }}
      >
        Open chain →
      </button>

      {drawerOpen && (
        <ChainDrawer
          transactionId={transactionId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setDrawerOpen(false)}
          onOpenAddNode={handleOpenAddNode}
          declineNotification={declineNotification}
          refreshKey={refreshKey}
        />
      )}

      {addNode && (
        <AddNodeDrawer
          chainId={addNode.chainId}
          transactionId={transactionId}
          direction={addNode.direction}
          editingLink={addNode.editingLink}
          onClose={handleCloseAddNode}
          onSaved={handleNodeSaved}
        />
      )}
    </>
  );
}
