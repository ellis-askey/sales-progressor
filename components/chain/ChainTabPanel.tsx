"use client";

import { ChainView } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import { useChainAddNode } from "@/components/chain/use-chain-add-node";
import type { ChainTabPayload } from "@/lib/services/chains";

type Props = {
  transactionId: string;
  currentUserId: string;
  currentUserRole?: string | null;
  declineNotification?: { address: string; at: string } | null;
  initialChainData?: ChainTabPayload | null;
};

// The chain on the property file's own tab — the same ChainView the slide-over
// uses, rendered inline. The AddNodeDrawer still opens as an overlay on top (it's
// a form, not the chain body). Off the file, ViewChainButton opens the drawer.
export function ChainTabPanel({ transactionId, currentUserId, currentUserRole, declineNotification, initialChainData }: Props) {
  const { addNode, openAddNode, closeAddNode, onNodeSaved, refreshKey } = useChainAddNode();

  return (
    <>
      <ChainView
        variant="inline"
        transactionId={transactionId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onClose={() => {}}
        onOpenAddNode={openAddNode}
        declineNotification={declineNotification ?? null}
        refreshKey={refreshKey}
        initialChainData={initialChainData ?? null}
      />

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
