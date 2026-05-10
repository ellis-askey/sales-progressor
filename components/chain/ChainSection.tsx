"use client";

import { useState } from "react";
import { AddNodeDrawer, type StubFormData, type EditingLinkData } from "@/components/chain/AddNodeDrawer";

export type InMemoryStub = StubFormData & {
  id: string;
  direction: "above" | "below";
};

type ChainPosition = "top" | "bottom" | "middle" | "unknown";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  stubs: InMemoryStub[];
  onAddStub: (stub: InMemoryStub) => void;
  onEditStub: (id: string, data: StubFormData) => void;
  onRemoveStub: (id: string) => void;
  originatorAddress: string;
};

function StubCard({
  stub,
  onEdit,
  onRemove,
}: {
  stub: InMemoryStub;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const parts = stub.stubPropertyAddress.split(",");
  const address1 = parts[0]?.trim() || stub.stubPropertyAddress;
  const address2 = parts.slice(1).join(",").trim();
  const hasValidEmail = stub.stubAgentEmail && EMAIL_RE.test(stub.stubAgentEmail);

  return (
    <div className="glass-card border-l-4 border-l-white/20 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900/90 truncate">{address1}</p>
          {address2 && <p className="text-xs text-slate-900/40 truncate">{address2}</p>}
          {stub.stubAgencyName && <p className="text-xs text-slate-900/50 mt-0.5">{stub.stubAgencyName}</p>}
          <p className="text-xs mt-0.5">
            {hasValidEmail
              ? <span className="text-slate-900/40">{stub.stubAgentEmail}</span>
              : <span className="text-amber-500">Email needed to send invite</span>
            }
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-slate-900/40 agent-hover-link transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-slate-900/30 hover:text-red-500 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function OriginatorCard({ address }: { address: string }) {
  const parts = address.split(",");
  const address1 = parts[0]?.trim() || "Your sale";
  const address2 = parts.slice(1).join(",").trim();

  return (
    <div className="glass-card border-l-4 border-l-[#FF6B4A] px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900/90 truncate">
            {address1 || "Your sale"}
          </p>
          {address2 && <p className="text-xs text-slate-900/40 truncate">{address2}</p>}
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6B4A] border border-orange-100">
          Your file
        </span>
      </div>
    </div>
  );
}

export function ChainSection({
  expanded,
  onExpand,
  onCollapse,
  stubs,
  onAddStub,
  onEditStub,
  onRemoveStub,
  originatorAddress,
}: Props) {
  const [position, setPosition] = useState<ChainPosition>("unknown");
  const [addNodeDir, setAddNodeDir] = useState<"above" | "below" | null>(null);
  const [editingStub, setEditingStub] = useState<InMemoryStub | null>(null);

  const aboveStubs = stubs.filter((s) => s.direction === "above");
  const belowStubs = stubs.filter((s) => s.direction === "below");

  const showAddAbove = position !== "top";
  const showAddBelow = position !== "bottom";

  function handleSaveToMemory(data: StubFormData, direction: "above" | "below") {
    if (editingStub) {
      onEditStub(editingStub.id, data);
    } else {
      onAddStub({
        ...data,
        id: Math.random().toString(36).slice(2),
        direction,
      });
    }
  }

  function handleCollapse() {
    if (stubs.length > 0) {
      if (!confirm(`Discard chain and ${stubs.length} added node${stubs.length !== 1 ? "s" : ""}?`)) return;
    }
    setPosition("unknown");
    onCollapse();
  }

  function handleChangePosition(value: ChainPosition) {
    if (value === "top" && aboveStubs.length > 0) {
      if (!confirm(`You've added ${aboveStubs.length} node${aboveStubs.length !== 1 ? "s" : ""} above. Remove them?`)) return;
      aboveStubs.forEach((s) => onRemoveStub(s.id));
    }
    if (value === "bottom" && belowStubs.length > 0) {
      if (!confirm(`You've added ${belowStubs.length} node${belowStubs.length !== 1 ? "s" : ""} below. Remove them?`)) return;
      belowStubs.forEach((s) => onRemoveStub(s.id));
    }
    setPosition(value);
  }

  const editingLinkData: EditingLinkData | undefined = editingStub
    ? {
        id: editingStub.id,
        stubPropertyAddress: editingStub.stubPropertyAddress,
        stubAgencyName: editingStub.stubAgencyName,
        stubAgentName: editingStub.stubAgentName,
        stubAgentEmail: editingStub.stubAgentEmail,
        stubAgentPhone: editingStub.stubAgentPhone,
        stubNotes: editingStub.stubNotes,
      }
    : undefined;

  if (!expanded) {
    return (
      <div className="rounded-xl agent-chain-callout px-4 py-3.5 flex items-center justify-between gap-4">
        <div>
          <p className="glass-section-label text-slate-900/50 mb-1">
            Chain <span className="text-slate-900/30 font-normal normal-case">(optional)</span>
          </p>
          <p className="text-sm text-slate-900/60">Is this property part of a chain?</p>
          <p className="text-xs text-slate-900/40 mt-0.5">Adding a chain sends invite links to the other agents involved.</p>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg agent-chain-callout-btn"
        >
          + Add chain
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="glass-section-label text-slate-900/40">
          Chain{" "}
          <span className="text-slate-900/30 font-normal normal-case">(optional)</span>
        </h2>
        <button
          type="button"
          onClick={handleCollapse}
          className="text-xs text-slate-900/40 hover:text-red-500 transition-colors"
        >
          × Remove chain
        </button>
      </div>

      {/* Position selector */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-900/60 mb-2">
          Your sale's position in the chain
        </p>
        <div className="flex flex-col gap-1.5">
          {([
            ["top", "Top of chain", "No sale above this one"],
            ["bottom", "Bottom of chain", "No sale below this one"],
            ["middle", "Middle of chain", ""],
            ["unknown", "I don't know yet", ""],
          ] as [ChainPosition, string, string][]).map(([value, label, note]) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="chainPosition"
                value={value}
                checked={position === value}
                onChange={() => handleChangePosition(value)}
                className="accent-blue-500"
              />
              <span className="text-sm text-slate-900/70">{label}</span>
              {note && <span className="text-xs text-slate-900/35">{note}</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Chain cards stack */}
      <div className="space-y-1.5 mb-3">
        {/* Above stubs — newest last added = highest = rendered first */}
        {[...aboveStubs].reverse().map((stub) => (
          <StubCard
            key={stub.id}
            stub={stub}
            onEdit={() => { setEditingStub(stub); setAddNodeDir("above"); }}
            onRemove={() => onRemoveStub(stub.id)}
          />
        ))}

        {/* Originator card */}
        <OriginatorCard address={originatorAddress} />

        {/* Below stubs — oldest first = closest below */}
        {belowStubs.map((stub) => (
          <StubCard
            key={stub.id}
            stub={stub}
            onEdit={() => { setEditingStub(stub); setAddNodeDir("below"); }}
            onRemove={() => onRemoveStub(stub.id)}
          />
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        {showAddAbove && (
          <button
            type="button"
            onClick={() => { setAddNodeDir("above"); setEditingStub(null); }}
            className="flex-1 text-xs font-semibold py-2 rounded-xl agent-chain-callout-btn"
          >
            + Add sale above
          </button>
        )}
        {showAddBelow && (
          <button
            type="button"
            onClick={() => { setAddNodeDir("below"); setEditingStub(null); }}
            className="flex-1 text-xs font-semibold py-2 rounded-xl agent-chain-callout-btn"
          >
            + Add sale below
          </button>
        )}
      </div>

      {/* Add / edit node drawer */}
      {addNodeDir && (
        <AddNodeDrawer
          direction={editingStub?.direction ?? addNodeDir}
          editingLink={editingLinkData}
          onSaveToMemory={handleSaveToMemory}
          onClose={() => { setAddNodeDir(null); setEditingStub(null); }}
          onSaved={() => { setAddNodeDir(null); setEditingStub(null); }}
        />
      )}
    </div>
  );
}
