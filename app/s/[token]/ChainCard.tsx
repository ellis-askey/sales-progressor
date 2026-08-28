import { House } from "@phosphor-icons/react/dist/ssr";
import { PortalCard, CardKicker } from "./portal-cards";
import { S } from "./ui";

// The chain — SHAPE + rolled-up % + address ONLY (decision B2). No per-link
// status words, no prices, no stuck-step detail (all viewer-gated upstream, so
// calling the chain service without a viewer strips them automatically).
export type ChainNode = { key: string; label: string; percent: number | null; isThisMatter: boolean; claimed: boolean };

export function ChainCard({ nodes }: { nodes: ChainNode[] }) {
  return (
    <PortalCard glassId="sol-chain" label="Chain summary" style={{ padding: "18px 14px 16px" }}>
      <div style={{ padding: "0 4px" }}>
        <CardKicker>Chain summary</CardKicker>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", paddingBottom: 2 }}>
        {nodes.map((n, i) => (
          <div key={n.key} style={{ display: "flex", alignItems: "flex-start", flex: "1 0 auto" }}>
            <Node node={n} />
            {i < nodes.length - 1 && (
              <div style={{ width: 20, height: 2, marginTop: 21, background: "rgba(15,39,64,0.14)", flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
    </PortalCard>
  );
}

function Node({ node }: { node: ChainNode }) {
  const color = node.isThisMatter ? S.accent : node.percent === 100 ? S.successRing : "rgba(15,39,64,0.3)";
  const sub = node.isThisMatter
    ? "This matter"
    : node.claimed && node.percent != null
      ? `${node.percent}% complete`
      : "Not linked yet";
  const subColor = node.isThisMatter ? S.accent : node.claimed && node.percent != null ? S.muted : S.faint;
  return (
    <div style={{ width: 104, minWidth: 104, textAlign: "center" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${color}`,
          background: node.isThisMatter ? S.accentBg : node.percent === 100 ? S.successBg : "#fff",
          color,
        }}
      >
        <House size={20} weight={node.isThisMatter ? "fill" : "regular"} />
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 12, fontWeight: 600, color: S.ink, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{node.label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 11, color: subColor, fontWeight: node.isThisMatter ? 600 : 400, lineHeight: 1.3 }}>{sub}</p>
    </div>
  );
}
