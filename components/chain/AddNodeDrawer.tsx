"use client";

// Implemented in Chunk 5. This stub satisfies imports during Chunk 4.

import type { ChainLinkV2 } from "@/lib/services/chains";

type Props = {
  transactionId: string;
  direction: "above" | "below";
  editingLink?: ChainLinkV2;
  onClose: () => void;
  onSaved: () => void;
};

export function AddNodeDrawer(_props: Props) {
  return null;
}
