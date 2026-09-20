// Shared chain-map types + palette, with NO maplibre-gl dependency, so the
// panel/legend can import the colours without pulling the (client-only, heavy)
// map bundle in. ChainGeoMap is the only thing that touches maplibre-gl.

export type ChainMapStatus = "yours" | "completed" | "claimed" | "invited" | "unclaimed";

export type ChainMapNode = {
  id: string; // chain link id
  label: string; // pin text — the chain number for a spine node, "↑" for an onward purchase
  onward?: boolean; // a branch (onward purchase) node — drawn a touch smaller
  address: string;
  status: ChainMapStatus;
};

// A move between two properties. `fork` = a spine seller buying an onward
// purchase (a branch); `broken` = the household leaves the chain.
export type ChainMapMove = { fromId: string; toId: string; broken?: boolean; fork?: boolean };

// Restrained TSP palette — your sale coral, claimed green, invited amber,
// unclaimed grey, completed a deeper green. Four legend colours + a done shade.
export const CHAIN_STATUS_COLOR: Record<ChainMapStatus, string> = {
  yours: "#FF6B4A",
  completed: "#1F8A4A",
  claimed: "#2F9E63",
  invited: "#E0A32E",
  unclaimed: "#94A3B8",
};

export const CHAIN_STATUS_LABEL: Record<ChainMapStatus, string> = {
  yours: "Your sale",
  completed: "Completed",
  claimed: "Claimed",
  invited: "Invited",
  unclaimed: "Unclaimed",
};
