"use client";

import { ChainSection, type InMemoryStub } from "@/components/chain/ChainSection";
import type { StubFormData } from "@/components/chain/AddNodeDrawer";

type Props = {
  stubs: InMemoryStub[];
  expanded: boolean;
  originatorAddress: string;
  // Plain-English reason the section auto-opened (audit #5). Null when the
  // agent opened it themselves / it isn't a chain-likely purchase type.
  autoOpenReason?: string | null;
  onExpand: () => void;
  onCollapse: () => void;
  onAddStub: (stub: InMemoryStub) => void;
  onEditStub: (id: string, data: StubFormData) => void;
  onRemoveStub: (id: string) => void;
};

export function FormChainSection({
  stubs, expanded, originatorAddress, autoOpenReason,
  onExpand, onCollapse, onAddStub, onEditStub, onRemoveStub,
}: Props) {
  return (
    <ChainSection
      expanded={expanded}
      autoOpenReason={autoOpenReason}
      onExpand={onExpand}
      onCollapse={() => {
        onCollapse();
      }}
      stubs={stubs}
      onAddStub={onAddStub}
      onEditStub={onEditStub}
      onRemoveStub={onRemoveStub}
      originatorAddress={originatorAddress}
    />
  );
}
