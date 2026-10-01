// A progressor's per-client rate card — how they charge for the sales they
// progress for a given client agency. Stored as JSON on
// ProgressionBusinessClient.feeModel, validated here. Pure + isomorphic: used by
// the Overview service (server) and the fee-engine editor (client).

export type FlatFee = { type: "flat"; pence: number };
export type TieredBand = { uptoPence: number | null; pence: number };
export type TieredFee = { type: "tiered"; bands: TieredBand[] };
export type PercentFee = { type: "percent"; bps: number }; // basis points: 30 = 0.30%
export type ClientFeeModel = FlatFee | TieredFee | PercentFee;

export const DEFAULT_FEE_MODEL: ClientFeeModel = { type: "flat", pence: 30000 }; // £300 / sale

export const DEFAULT_TIERS: TieredBand[] = [
  { uptoPence: 30000000, pence: 25000 },  // up to £300k -> £250
  { uptoPence: 50000000, pence: 35000 },  // £300k–£500k -> £350
  { uptoPence: 75000000, pence: 45000 },  // £500k–£750k -> £450
  { uptoPence: null, pence: 55000 },       // £750k+ -> £550
];

/** The fee (pence) this model charges for a sale at the given price, or null. */
export function calculateClientFee(model: ClientFeeModel | null, pricePence: number | null): number | null {
  if (!model) return null;
  switch (model.type) {
    case "flat":
      return model.pence;
    case "percent":
      return pricePence == null ? null : Math.round((pricePence * model.bps) / 10000);
    case "tiered": {
      if (pricePence == null) return null;
      const bands = [...model.bands].sort(
        (a, b) => (a.uptoPence ?? Number.POSITIVE_INFINITY) - (b.uptoPence ?? Number.POSITIVE_INFINITY),
      );
      for (const b of bands) if (b.uptoPence == null || pricePence <= b.uptoPence) return b.pence;
      return bands.length ? bands[bands.length - 1].pence : null;
    }
  }
}

/** Validate/sanitise unknown JSON (from the DB or a form) into a ClientFeeModel. */
export function parseFeeModel(raw: unknown): ClientFeeModel | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "flat" && typeof o.pence === "number" && o.pence >= 0) {
    return { type: "flat", pence: Math.round(o.pence) };
  }
  if (o.type === "percent" && typeof o.bps === "number" && o.bps >= 0 && o.bps <= 10000) {
    return { type: "percent", bps: Math.round(o.bps) };
  }
  if (o.type === "tiered" && Array.isArray(o.bands)) {
    const bands: TieredBand[] = o.bands
      .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
      .map((b) => ({
        uptoPence: typeof b.uptoPence === "number" ? Math.round(b.uptoPence) : null,
        pence: typeof b.pence === "number" && b.pence >= 0 ? Math.round(b.pence) : 0,
      }));
    if (bands.length) return { type: "tiered", bands };
  }
  return null;
}

/** A one-line human summary of a fee model. */
export function feeModelSummary(model: ClientFeeModel | null): string {
  if (!model) return "No fee model set";
  if (model.type === "flat") return `£${(model.pence / 100).toLocaleString()} per sale`;
  if (model.type === "percent") return `${(model.bps / 100).toFixed(2)}% of price`;
  return `Tiered · ${model.bands.length} price bands`;
}
