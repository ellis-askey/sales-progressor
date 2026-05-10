"use client";

import { ChainSection, type InMemoryStub } from "@/components/chain/ChainSection";
import type { StubFormData } from "@/components/chain/AddNodeDrawer";

type Props = {
  stubs: InMemoryStub[];
  expanded: boolean;
  originatorAddress: string;
  onExpand: () => void;
  onCollapse: () => void;
  onAddStub: (stub: InMemoryStub) => void;
  onEditStub: (id: string, data: StubFormData) => void;
  onRemoveStub: (id: string) => void;
};

export function FormChainSection({
  stubs, expanded, originatorAddress,
  onExpand, onCollapse, onAddStub, onEditStub, onRemoveStub,
}: Props) {
  return (
    <ChainSection
      expanded={expanded}
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
