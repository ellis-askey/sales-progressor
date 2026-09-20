"use client";

import { useState } from "react";
import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import { useChainAddNode } from "@/components/chain/use-chain-add-node";
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
  const { addNode, openAddNode, closeAddNode, onNodeSaved, refreshKey } = useChainAddNode();

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
          onOpenAddNode={openAddNode}
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
          insertBetween={addNode.insertBetween}
          focusField={addNode.focusField}
          onClose={closeAddNode}
          onSaved={onNodeSaved}
        />
      )}
    </>
  );
}
