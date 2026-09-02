"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/glass/GlassCard";

type PricePaid = { date: string; amount: number; propertyType: string; newBuild: boolean; estateType: string; paon?: string; saon?: string; street?: string };
type Epc = { rating: string; score: number | null; potentialRating: string; potentialScore: number | null; propertyType: string; floorArea: number | null; builtForm: string; inspectionDate: string; validUntil: string | null };
type Links = { rightmove: string; zoopla: string; landReg: string };

type IntelData = {
  postcode: string | null;
  address: string;
  pricePaid: PricePaid[];
  epc: Epc | null;
  epcError: boolean;
  epcConfigured: boolean;
  links: Links | null;
};

// Land Registry built-form/property-type strings are ALL CAPS or slugged; make
// them read like a person wrote them ("Semi-Detached", "Purpose Built Flat").
function tidy(s: string): string {
  return (s ?? "")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function fmtFullDate(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtMonthYear(d: string): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
function yearOf(d: string): string {
  if (!d) return "";
  return String(new Date(d).getFullYear());
}
function poundsFmt(pounds: number): string {
  return "£" + pounds.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}
function yearsAgo(d: string): string {
  if (!d) return "";
  const yrs = Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 86400000));
  if (yrs <= 0) return "this year";
  return `${yrs} year${yrs === 1 ? "" : "s"} ago`;
}

// EPC A–G band colours (mirrors the GOV.UK certificate ladder).
const EPC_HEX: Record<string, string> = {
  A: "#16a34a", B: "#22c55e", C: "#84cc16", D: "#eab308", E: "#fb923c", F: "#ea580c", G: "#dc2626",
};
const EPC_BANDS = ["A", "B", "C", "D", "E", "F", "G"];

export function PropertyIntelCard({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/property-intel?transactionId=${transactionId}`)
      .then((r) => { if (!r.ok) throw new Error("not ok"); return r.json(); })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [transactionId]);

  // ── Derived figures (only from real data; each guarded) ────────────────────
  const sales = (data?.pricePaid ?? [])
    .filter((p) => p.date)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const priced = sales.filter((s) => s.amount > 0);
  const last = sales[0] ?? null;
  const lastPriced = priced[0] ?? null;
  const firstPriced = priced[priced.length - 1] ?? null;
  const epc = data?.epc ?? null;

  const pricePerM2 =
    lastPriced && epc?.floorArea && epc.floorArea > 0
      ? Math.round(lastPriced.amount / epc.floorArea)
      : null;
  const growthPct =
    lastPriced && firstPriced && firstPriced !== lastPriced && firstPriced.amount > 0
      ? Math.round(((lastPriced.amount - firstPriced.amount) / firstPriced.amount) * 100)
      : null;

  const tenure = last?.estateType ? tidy(last.estateType) : null;
  const propType = last?.propertyType ? tidy(last.propertyType) : (epc?.propertyType ? tidy(epc.propertyType) : null);
  const subtitleBits = [data?.postcode, propType, tenure].filter(Boolean).join(" · ");

  const lbl = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--agent-text-muted)" };

  return (
    // Design Lab: `overview-property-intel`. Default v05 (Heavy frost).
    <GlassCard glassId="overview-property-intel" label="Overview · Property intel" defaultVariant="v05" className="overflow-hidden rounded-[12px]">
      <div className="agent-card-hdr">
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Property Intel</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitleBits || "Land Registry · EPC · Search links"}
          </p>
        </div>
        {data?.links && (
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <a href={data.links.rightmove} target="_blank" rel="noopener noreferrer"
               className="text-xs px-2.5 py-1 rounded-lg bg-[#00deb6] text-white font-medium hover:opacity-90 transition-opacity">Rightmove</a>
            <a href={data.links.zoopla} target="_blank" rel="noopener noreferrer"
               className="text-xs px-2.5 py-1 rounded-lg bg-[#8c1d82] text-white font-medium hover:opacity-90 transition-opacity">Zoopla</a>
            <a href={data.links.landReg} target="_blank" rel="noopener noreferrer"
               className="text-xs px-2.5 py-1 rounded-lg bg-[#1d70b8] text-white font-medium hover:opacity-90 transition-opacity">Title info</a>
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {loading && <p className="text-sm text-center py-4" style={{ color: "var(--agent-text-muted)" }}>Fetching property data…</p>}
        {error && <p className="text-sm text-center py-4" style={{ color: "var(--agent-text-muted)" }}>Could not load property data.</p>}

        {!loading && !error && data && (
          <div className="agent-reveal-in">
            <p className="text-[11px] mb-3 italic" style={{ color: "var(--agent-text-muted)" }}>
              Data sourced from Land Registry and EPC Register. Always verify before use.
            </p>

            {/* ── Hero: last sold ───────────────────────────────────────────── */}
            {last ? (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={lbl}>Last sold</div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 2, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    {last.amount > 0 ? poundsFmt(last.amount) : "Price withheld"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                    {fmtMonthYear(last.date)}{last.date ? ` · ${yearsAgo(last.date)}` : ""}
                  </div>
                </div>
                {(pricePerM2 || growthPct !== null) && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {pricePerM2 && (
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-teal, #00b89a)", fontVariantNumeric: "tabular-nums" }}>
                        {poundsFmt(pricePerM2)}/m²
                      </div>
                    )}
                    {growthPct !== null && firstPriced && (
                      <div style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
                        {growthPct >= 0 ? "+" : ""}{growthPct}% since {yearOf(firstPriced.date)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: "var(--agent-text-muted)" }}>No sales found for this postcode.</p>
            )}

            {/* ── EPC ───────────────────────────────────────────────────────── */}
            <div style={{ borderTop: "0.5px solid var(--agent-border-default)", margin: "14px 0 0", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={lbl}>Energy · EPC</span>
                {epc?.inspectionDate && (
                  <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
                    Inspected {fmtMonthYear(epc.inspectionDate)}{epc.validUntil ? ` · valid to ${yearOf(epc.validUntil)}` : ""}
                  </span>
                )}
              </div>

              {epc ? (
                <>
                  <div style={{ display: "grid", gap: 3 }}>
                    {EPC_BANDS.map((band, i) => {
                      const isNow = epc.rating === band;
                      const isPotential = !!epc.potentialRating && epc.potentialRating === band && epc.potentialRating !== epc.rating;
                      const width = 40 + i * 10; // A shortest → G longest, like the GOV.UK ladder
                      return (
                        <div key={band} style={{ display: "flex", alignItems: "center", height: 20, position: "relative" }}>
                          <div style={{
                            width: `${width}%`, height: "100%", borderRadius: 3, display: "flex", alignItems: "center",
                            padding: "0 8px", fontSize: 10, fontWeight: 800, color: "#08120e",
                            background: EPC_HEX[band] ?? "rgba(148,163,184,0.4)",
                            opacity: isNow || isPotential ? 1 : 0.5,
                          }}>
                            {band}{isNow && epc.score !== null ? ` · ${epc.score}` : ""}
                          </div>
                          {(isNow || isPotential) && (
                            <span style={{
                              position: "absolute", right: 6, fontSize: 10, fontWeight: 800,
                              color: "#08120e", background: "rgba(255,255,255,0.85)", padding: "1px 7px", borderRadius: 999,
                            }}>
                              {isNow ? "Now" : `Potential${epc.potentialScore !== null ? ` ${epc.potentialScore}` : ""}`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 9 }}>
                    <span style={{ fontSize: 11, color: "var(--agent-text-secondary)" }}>
                      {[
                        [epc.builtForm && tidy(epc.builtForm), epc.propertyType && tidy(epc.propertyType)].filter(Boolean).join(" "),
                        epc.floorArea ? `${Math.round(epc.floorArea)} m²` : "",
                      ].filter(Boolean).join(" · ")}
                    </span>
                    {data.postcode && (
                      <a
                        href={`https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(data.postcode)}`}
                        target="_blank" rel="noopener noreferrer" className="agent-link" style={{ fontSize: 11.5, flexShrink: 0 }}
                      >
                        GOV.UK →
                      </a>
                    )}
                  </div>
                </>
              ) : data.epcError ? (
                <p className="text-xs italic" style={{ color: "var(--agent-text-muted)" }}>Couldn&rsquo;t reach the EPC register. Try again shortly.</p>
              ) : data.epcConfigured ? (
                <p className="text-xs italic" style={{ color: "var(--agent-text-muted)" }}>No certificate on record for this address.</p>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--agent-text-muted)" }}>EPC data is currently unavailable.</p>
              )}
            </div>

            {/* ── Sold history (older sales, with growth to the next sale) ────── */}
            {sales.length > 1 && (
              <div style={{ borderTop: "0.5px solid var(--agent-border-default)", margin: "14px 0 0", paddingTop: 14 }}>
                <div style={{ ...lbl, marginBottom: 10 }}>Sold history</div>
                <div style={{ display: "grid", gap: 9 }}>
                  {sales.slice(1, 5).map((entry, i) => {
                    // Growth from THIS sale up to the next-newer priced sale.
                    const newer = sales[sales.indexOf(entry) - 1];
                    const delta = entry.amount > 0 && newer?.amount > 0
                      ? Math.round(((newer.amount - entry.amount) / entry.amount) * 100)
                      : null;
                    return (
                      <div key={i} className="agent-hover-row rounded-md px-1 -mx-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                            {entry.amount > 0 ? poundsFmt(entry.amount) : "Price withheld"}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: 8 }}>{fmtMonthYear(entry.date)}</span>
                        </div>
                        {delta !== null && newer && (
                          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                            {delta >= 0 ? "+" : ""}{delta}% → {yearOf(newer.date)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
