"use client";

// Live companion map for the new-sale chain builder (2026-09-21). Renders the
// REAL ChainGeoMap (same MapLibre map as the post-creation "Map" view), seeded
// from the in-memory stubs the agent is typing — so the glimpse they get while
// building IS the real thing, seeded early. It geocodes each postcode itself and
// falls back to straight connector lines until real driving routes exist.
//
// Rendered as a full-width card below the new-sale form's two columns (so its
// summary bar + zoom controls have room). Counts EVERY property in the chain
// (your file + each added sale); the ones with a real postcode drop a pin, the
// rest are counted but wait for a postcode. Attribution control hidden.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { InMemoryStub } from "@/components/chain/ChainSection";
import { extractPostcode } from "@/lib/geo/postcode";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type { ChainMapNode, ChainMapMove, ChainMapDetail, ChainMapStatus } from "@/components/chain/chain-map-shared";

const ChainGeoMap = dynamic(
  () => import("@/components/chain/ChainGeoMap").then((m) => m.ChainGeoMap),
  { ssr: false, loading: () => <Placeholder label="Loading map…" /> },
);

const YOU_ID = "__you__";

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{
      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: 22,
    }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", maxWidth: 220, lineHeight: 1.55 }}>{label}</p>
    </div>
  );
}

// Chain order bottom → top: below-stubs, your file, above-stubs. EVERY member is
// a node (so the property/move counts match what they've added); nodes without a
// real postcode just aren't geocodable yet, so ChainGeoMap simply doesn't pin
// them. Moves connect each consecutive pair (lower buys the one above).
function buildMapData(stubs: InMemoryStub[], originatorAddress: string): {
  nodes: ChainMapNode[]; moves: ChainMapMove[]; details: Record<string, ChainMapDetail>; plotted: number;
} {
  const below = stubs.filter((s) => s.direction === "below");
  const above = stubs.filter((s) => s.direction === "above");

  const ordered = [
    ...below.map((s) => ({ id: s.id, address: s.stubPropertyAddress, agency: s.stubAgencyName || null, status: "unclaimed" as ChainMapStatus, mine: false })),
    { id: YOU_ID, address: originatorAddress, agency: null as string | null, status: "yours" as ChainMapStatus, mine: true },
    ...above.map((s) => ({ id: s.id, address: s.stubPropertyAddress, agency: s.stubAgencyName || null, status: "unclaimed" as ChainMapStatus, mine: false })),
  ].filter((n) => n.address && n.address.trim()); // must have *something* typed

  const nodes: ChainMapNode[] = ordered.map((n, i) => ({
    id: n.id, label: String(i + 1), address: n.address, status: n.status,
  }));

  const moves: ChainMapMove[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    moves.push({ fromId: ordered[i + 1].id, toId: ordered[i].id });
  }

  const details: Record<string, ChainMapDetail> = {};
  ordered.forEach((n, i) => {
    const parts = n.address.split(",");
    details[n.id] = {
      label: String(i + 1),
      line1: parts[0]?.trim() || n.address,
      line2: parts.slice(1).join(",").trim(),
      agency: n.agency,
      photoUrl: null,
      status: n.status,
      progressPercent: n.mine ? 0 : null,
      href: null,
    };
  });

  const plotted = ordered.filter((n) => !!extractPostcode(n.address)).length;
  return { nodes, moves, details, plotted };
}

export function ChainBuildMap({ stubs, originatorAddress, bare = false }: { stubs: InMemoryStub[]; originatorAddress: string; bare?: boolean }) {
  const { isNight } = usePortalTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { nodes, moves, details, plotted } = useMemo(
    () => buildMapData(stubs, originatorAddress),
    [stubs, originatorAddress],
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column", flex: 1, minWidth: 0,
      height: bare ? "100%" : undefined,
      borderRadius: bare ? 0 : "var(--agent-radius-lg, 16px)",
      border: bare ? "none" : "0.5px solid var(--agent-border-default)",
      background: bare ? "transparent" : "var(--agent-surface-glass)",
      padding: 10,
    }}>
      {/* Rounded map tile. The map renders as soon as there's anything in the
          chain — with just your file, your own pin drops immediately. Nodes
          without a real postcode are counted (top bar) but wait for a postcode;
          a hint shows only while nothing has geocoded yet. */}
      <div style={{
        position: "relative", flex: 1, minHeight: 360,
        borderRadius: 12, overflow: "hidden",
        border: "0.5px solid var(--agent-border-subtle)",
      }}>
        {nodes.length === 0 ? (
          <Placeholder label="Add a property with a postcode and it'll drop onto the map here. Your chain takes shape as you build it." />
        ) : (
          <>
            <ChainGeoMap nodes={nodes} moves={moves} details={details} selectedId={selectedId} onSelectNode={setSelectedId} theme={isNight ? "dark" : "light"} hideAttribution />
            {plotted === 0 && (
              <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, padding: "8px 11px", borderRadius: 10, background: "rgba(10,14,24,0.82)", border: "0.5px solid var(--agent-border-subtle)", pointerEvents: "none" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#e7edf7", lineHeight: 1.45 }}>Add a real UK postcode to any property to drop it onto the map.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
