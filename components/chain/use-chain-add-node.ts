"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { AddNodeSavedResult, EditingLinkData } from "@/components/chain/AddNodeDrawer";

// The add / edit / insert flow shared by every place that renders a ChainView —
// the slide-over (ViewChainButton) and the property-file tab (ChainTabPanel).
// ChainView delegates "open the add form" through onOpenAddNode; this hook holds
// the resulting AddNodeDrawer request, the refresh key that re-fetches the chain
// after a save, and the toast + router.refresh on save. One source of truth so
// the two surfaces behave identically.
export type AddNodeRequest = {
  direction: "above" | "below";
  chainId: string;
  editingLink?: EditingLinkData;
  forkFromLinkId?: string;
  aboveOfLinkId?: string;
  insertBetween?: { anchorLinkId: string; placement: "above" | "below" };
};

export function useChainAddNode() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [addNode, setAddNode] = useState<AddNodeRequest | null>(null);
  const router = useRouter();
  const { toast } = useAgentToast();

  const openAddNode = useCallback(
    (
      direction: "above" | "below",
      chainId: string,
      editingLink?: EditingLinkData,
      forkFromLinkId?: string,
      aboveOfLinkId?: string,
      insertBetween?: { anchorLinkId: string; placement: "above" | "below" },
    ) => {
      setAddNode({ direction, chainId, editingLink, forkFromLinkId, aboveOfLinkId, insertBetween });
    },
    [],
  );

  const closeAddNode = useCallback(() => setAddNode(null), []);

  const onNodeSaved = useCallback(
    (result?: AddNodeSavedResult) => {
      setAddNode(null);
      setRefreshKey((k) => k + 1);
      // Chain mutations go through /api/chains route handlers, which can't
      // revalidate on their own — refresh the surrounding server surface (the
      // file page or the chains workspace counts) so it doesn't stay stale.
      router.refresh();
      if (!result) return;
      if (result.kind === "edited") {
        toast.success("Sale updated");
      } else {
        toast.success(result.inviteSent ? "Sale added · Invite sent" : "Sale added");
      }
    },
    [router, toast],
  );

  return { addNode, openAddNode, closeAddNode, onNodeSaved, refreshKey };
}
