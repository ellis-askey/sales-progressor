"use client";

import { ChainSection, type InMemoryStub } from "@/components/chain/ChainSection";
import type { StubFormData } from "@/components/chain/AddNodeDrawer";

// The live companion map now lives in the form's RIGHT column (see
// ChainBuildMap, rendered by NewSaleFlow) so it isn't squished beside the
// builder — this section is just the builder itself.

type Props = {
  stubs: InMemoryStub[];
  expanded: boolean;
  originatorAddress: string;
  // Plain-English reason the section auto-opened (audit #5). Null when the
  // agent opened it themselves / it isn't a chain-likely purchase type.
  autoOpenReason?: string | null;
  // Render the expanded builder bare (no card chrome) so it can be the left half
  // of the shared full-width "builder + map" card.
  bare?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onAddStub: (stub: InMemoryStub) => void;
  onEditStub: (id: string, data: StubFormData) => void;
  onRemoveStub: (id: string) => void;
};

export function FormChainSection({
  stubs, expanded, originatorAddress, autoOpenReason, bare = false,
  onExpand, onCollapse, onAddStub, onEditStub, onRemoveStub,
}: Props) {
  return (
    <ChainSection
      expanded={expanded}
      autoOpenReason={autoOpenReason}
      bare={bare}
      onExpand={onExpand}
      onCollapse={onCollapse}
      stubs={stubs}
      onAddStub={onAddStub}
      onEditStub={onEditStub}
      onRemoveStub={onRemoveStub}
      originatorAddress={originatorAddress}
    />
  );
}
