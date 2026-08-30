"use client";

import { useState, useEffect } from "react";
import { LinkSimple, Plus } from "@phosphor-icons/react";
import { AddNodeDrawer, type StubFormData, type EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { Pill } from "@/components/ui/Pill";
import { useCardSurface } from "@/lib/glass/use-card-surface";

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
  // When set, the section opened itself because the purchase type makes a
  // chain likely (audit #5). Reframes the header as a direct question and
  // shows the reason so the open state never feels arbitrary.
  autoOpenReason?: string | null;
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
  const { surfaceClass, tag } = useCardSurface("new-sale-chain-link", "New sale · Chain link", "glass-card");

  return (
    <div className={`${surfaceClass} px-4 py-3`} {...tag}>
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
  const { surfaceClass, tag, picked } = useCardSurface("new-sale-chain-yourfile", "New sale · Chain (your file)", "");

  return (
    <div
      className={`${surfaceClass} px-4 py-3`.trim()}
      {...tag}
      style={{
        borderRadius: 13,
        // Coral-tinted "your file" node by default; a Design Lab pick takes over.
        ...(picked ? {} : {
          background: "rgba(var(--agent-coral-rgb), 0.06)",
          boxShadow: "inset 0 0 0 1.5px rgba(var(--agent-coral-rgb), 0.30)",
        }),
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900/90 truncate">
            {address1 || "Your sale"}
          </p>
          {address2 && <p className="text-xs text-slate-900/40 truncate">{address2}</p>}
        </div>
        <Pill glass tone="brand" size="sm" className="flex-shrink-0">Your file</Pill>
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
  autoOpenReason,
}: Props) {
  const [position, setPosition] = useState<ChainPosition>("unknown");
  const [addNodeDir, setAddNodeDir] = useState<"above" | "below" | null>(null);
  const [editingStub, setEditingStub] = useState<InMemoryStub | null>(null);
  // Local "answered no" acknowledgement for the collapsed prompt's chip.
  const [dismissed, setDismissed] = useState(false);

  // ── Collapsed ⇆ expanded cross-fade ──────────────────────────────────────
  // The outgoing card fades down and out; the incoming fades up and in. Driven
  // off the `expanded` prop (plus the local "not in a chain" answer) with a
  // short out → swap → in sequence so both directions animate rather than the
  // content just being dumped onto the page.
  const targetView: "expanded" | "dismissed" | "collapsed" =
    expanded ? "expanded" : dismissed ? "dismissed" : "collapsed";
  const [view, setView] = useState<"expanded" | "dismissed" | "collapsed">(targetView);
  const [anim, setAnim] = useState<"none" | "in" | "out">("none");
  useEffect(() => {
    if (targetView === view) return;
    setAnim("out");
    const t = setTimeout(() => { setView(targetView); setAnim("in"); }, 180);
    return () => clearTimeout(t);
  }, [targetView, view]);

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
      if (!confirm(`Discard chain and ${stubs.length} added sale${stubs.length !== 1 ? "s" : ""}?`)) return;
    }
    setPosition("unknown");
    onCollapse();
  }

  function handleChangePosition(value: ChainPosition) {
    if (value === "top" && aboveStubs.length > 0) {
      if (!confirm(`You've added ${aboveStubs.length} sale${aboveStubs.length !== 1 ? "s" : ""} above. Remove them?`)) return;
      aboveStubs.forEach((s) => onRemoveStub(s.id));
    }
    if (value === "bottom" && belowStubs.length > 0) {
      if (!confirm(`You've added ${belowStubs.length} sale${belowStubs.length !== 1 ? "s" : ""} below. Remove them?`)) return;
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

  const cardRadius = "var(--agent-radius-lg, 16px)";
  const chainSurface = useCardSurface("new-sale-chain", "New sale · Chain", "agent-glass-strong");

  // Position options + the selected index, which slides the segmented pill.
  const POSITIONS: [ChainPosition, string][] = [
    ["top", "Top"],
    ["middle", "Middle"],
    ["bottom", "Bottom"],
    ["unknown", "Not sure yet"],
  ];
  const posIndex = Math.max(0, POSITIONS.findIndex(([v]) => v === position));

  // ── Collapsed prompt (Option D — decisive question + quick chips) ─────────
  const collapsedCard = (
    <div className={chainSurface.surfaceClass} {...chainSurface.tag} style={{ borderRadius: cardRadius, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
        <span style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center",
          color: "#fff",
          background: "linear-gradient(135deg, var(--agent-coral-deep), color-mix(in srgb, var(--agent-coral) 70%, #ffffff))",
          boxShadow: "0 6px 14px -6px rgba(var(--agent-coral-rgb), 0.6)",
        }}>
          <LinkSimple size={18} weight="bold" />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>
            Is this sale part of a chain?
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
            Add the chain and we&rsquo;ll send invite links to the other agents involved.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
        <button type="button" onClick={onExpand} className="chain-chip-yes">Yes, add the chain</button>
        <button type="button" onClick={() => setDismissed(true)} className="chain-chip-no">Not in a chain</button>
      </div>
    </div>
  );

  // ── Answered "no" — a compact resolved row that stays out of the way ──────
  const dismissedRow = (
    <div className={chainSurface.surfaceClass} {...chainSurface.tag} style={{ borderRadius: cardRadius, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--agent-text-muted)", background: "rgba(var(--agent-coral-rgb), 0.06)" }}>
          <LinkSimple size={15} weight="regular" />
        </span>
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>Not in a chain</p>
      </div>
      <button
        type="button"
        onClick={() => { setDismissed(false); onExpand(); }}
        style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--agent-coral-deep)" }}
      >
        + Add chain
      </button>
    </div>
  );

  // ── Expanded builder — now wrapped in its own white card ──────────────────
  const expandedCard = (
    <div className={chainSurface.surfaceClass} {...chainSurface.tag} style={{ borderRadius: cardRadius, padding: "18px 20px" }}>
      {/* Header. When the section opened itself (audit #5) it leads with the
          question + the reason; a manual open keeps the plain "Chain" label. */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          {autoOpenReason ? (
            <h2 className="text-sm font-semibold text-slate-900/80">Is this sale part of a chain?</h2>
          ) : (
            <h2 className="glass-section-label text-slate-900/40">
              Chain{" "}
              <span className="text-slate-900/30 font-normal normal-case">(optional)</span>
            </h2>
          )}
          <button
            type="button"
            onClick={handleCollapse}
            className="text-xs text-slate-900/40 hover:text-red-500 transition-colors flex-shrink-0"
          >
            {autoOpenReason ? "Not in a chain" : "× Remove chain"}
          </button>
        </div>
        {autoOpenReason && (
          <p className="text-xs text-slate-900/50 mt-1.5 leading-relaxed">
            This looks like a chain, because {autoOpenReason}, so we&rsquo;ve opened it for you. Add the linked sales and we&rsquo;ll invite their agents.
          </p>
        )}
      </div>

      {/* Position — segmented control. Choosing Top removes the add-above slot
          (and any sales above); Bottom removes the add-below slot. */}
      <div className="mb-1">
        <p className="text-xs font-medium text-slate-900/60 mb-2">
          Where does your sale sit?
        </p>
        <div className="chain-seg">
          <span className="chain-seg-ind" style={{ transform: `translateX(${posIndex * 100}%)` }} aria-hidden />
          {POSITIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={position === value ? "on" : ""}
              onClick={() => handleChangePosition(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chain rail — a real vertical chain. Add slots sit at the ends and only
          show where the chosen position allows a sale (above unless Top, below
          unless Bottom). Clicking a slot opens the node drawer with that
          direction, which is what tags the new sale as above/below. */}
      <div className="chain-rail">
        {/* Add-above slot. Always mounted; collapses + fades (grid-rows) when
            the position removes it, so the card resizes smoothly. */}
        <div className={`chain-slot${showAddAbove ? " open" : ""}`}>
          <div className="chain-slot-inner">
            <div className="chain-rail-item">
              <span className="chain-rail-dot" aria-hidden />
              <button
                type="button"
                className="chain-add-slot"
                onClick={() => { setAddNodeDir("above"); setEditingStub(null); }}
              >
                <Plus size={14} weight="bold" /> Add the sale above
              </button>
            </div>
          </div>
        </div>

        {/* Above stubs — newest last added = highest = rendered first */}
        {[...aboveStubs].reverse().map((stub) => (
          <div key={stub.id} className="chain-rail-item chain-node-enter">
            <span className="chain-rail-dot" aria-hidden />
            <StubCard
              stub={stub}
              onEdit={() => { setEditingStub(stub); setAddNodeDir("above"); }}
              onRemove={() => onRemoveStub(stub.id)}
            />
          </div>
        ))}

        {/* Your file */}
        <div className="chain-rail-item you">
          <span className="chain-rail-dot" aria-hidden />
          <OriginatorCard address={originatorAddress} />
        </div>

        {/* Below stubs — oldest first = closest below */}
        {belowStubs.map((stub) => (
          <div key={stub.id} className="chain-rail-item chain-node-enter">
            <span className="chain-rail-dot" aria-hidden />
            <StubCard
              stub={stub}
              onEdit={() => { setEditingStub(stub); setAddNodeDir("below"); }}
              onRemove={() => onRemoveStub(stub.id)}
            />
          </div>
        ))}

        {/* Add-below slot — same collapse treatment as add-above. */}
        <div className={`chain-slot${showAddBelow ? " open" : ""}`}>
          <div className="chain-slot-inner">
            <div className="chain-rail-item">
              <span className="chain-rail-dot" aria-hidden />
              <button
                type="button"
                className="chain-add-slot"
                onClick={() => { setAddNodeDir("below"); setEditingStub(null); }}
              >
                <Plus size={14} weight="bold" /> Add the sale below
              </button>
            </div>
          </div>
        </div>
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

  // The swap wrapper animates whichever card is showing. Once the entrance
  // finishes we clear the animation so no lingering transform creates a
  // containing block for the (fixed) AddNodeDrawer.
  const swapStyle = {
    animation:
      anim === "out" ? "chain-swap-out 180ms ease forwards"
      : anim === "in" ? "chain-swap-in 260ms var(--agent-ease, cubic-bezier(0.16,1,0.3,1)) both"
      : undefined,
  };

  return (
    <div style={swapStyle} onAnimationEnd={() => { if (anim === "in") setAnim("none"); }}>
      {view === "expanded" ? expandedCard : view === "dismissed" ? dismissedRow : collapsedCard}
    </div>
  );
}
