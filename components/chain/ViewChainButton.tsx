"use client";

import { useState } from "react";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import type { AddNodeSavedResult, EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { LinkArrow } from "@/components/ui/LinkArrow";

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [addNode, setAddNode] = useState<{
    direction: "above" | "below";
    chainId: string;
    editingLink?: EditingLinkData;
    forkFromLinkId?: string;
    aboveOfLinkId?: string;
  } | null>(null);
  const { toast } = useAgentToast();

  function handleOpenAddNode(
    direction: "above" | "below",
    chainId: string,
    link?: EditingLinkData,
    forkFromLinkId?: string,
    aboveOfLinkId?: string,
  ) {
    setAddNode({ direction, chainId, editingLink: link, forkFromLinkId, aboveOfLinkId });
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
          forkFromLinkId={addNode.forkFromLinkId}
          aboveOfLinkId={addNode.aboveOfLinkId}
          onClose={handleCloseAddNode}
          onSaved={handleNodeSaved}
        />
      )}
    </>
  );
}
