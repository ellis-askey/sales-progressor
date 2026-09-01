"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/glass/GlassCard";

type PricePaid = { date: string; amount: number; propertyType: string; newBuild: boolean; estateType: string };
type Epc = { rating: string; score: number | null; propertyType: string; floorArea: number | null; builtForm: string; inspectionDate: string };
type Links = { rightmove: string; zoopla: string; landReg: string };

type IntelData = {
  postcode: string | null;
  address: string;
  pricePaid: PricePaid[];
  epc: Epc | null;
  epcConfigured: boolean;
  links: Links | null;
};

const EPC_COLOURS: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-green-600",  text: "text-white" },
  B: { bg: "bg-green-500",  text: "text-white" },
  C: { bg: "bg-lime-500",   text: "text-white" },
  D: { bg: "bg-yellow-400", text: "text-slate-900/90" },
  E: { bg: "bg-orange-400", text: "text-white" },
  F: { bg: "bg-orange-600", text: "text-white" },
  G: { bg: "bg-red-600",    text: "text-white" },
};

function fmt(p: number) {
  return "£" + (p / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

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

  return (
    // Design Lab: `overview-property-intel`. Default v05 (Heavy frost)
    // per Ellis's final pick set, 2026-08-08 evening pass. Replaces the
    // legacy glass-card class — surface now comes from the variant.
    // 2026-08-09: text colours moved off hardcoded text-slate-900/* Tailwind
    // utilities onto --agent-text-* tokens so the card reads in dark mode.
    <GlassCard glassId="overview-property-intel" label="Overview · Property intel" defaultVariant="v05" className="overflow-hidden rounded-[12px]">
      <div className="agent-card-hdr">
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Property Intel</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)" }}>
            {data?.postcode ?? "Land Registry · EPC · Search links"}
          </p>
        </div>
        {data?.links && (
          <div className="flex items-center gap-2">
            <a href={data.links.rightmove} target="_blank" rel="noopener noreferrer"
               className="text-xs px-2.5 py-1 rounded-lg bg-[#00deb6] text-white font-medium hover:opacity-90 transition-opacity">
              Rightmove
            </a>
            <a href={data.links.zoopla} target="_blank" rel="noopener noreferrer"
               className="text-xs px-2.5 py-1 rounded-lg bg-[#8c1d82] text-white font-medium hover:opacity-90 transition-opacity">
              Zoopla
            </a>
            <a href={data.links.landReg} target="_blank" rel="noopener noreferrer"
               className="text-xs px-2.5 py-1 rounded-lg bg-[#1d70b8] text-white font-medium hover:opacity-90 transition-opacity">
              Title info
            </a>
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {loading && (
          <p className="text-sm text-center py-4" style={{ color: "var(--agent-text-muted)" }}>Fetching property data…</p>
        )}

        {error && (
          <p className="text-sm text-center py-4" style={{ color: "var(--agent-text-muted)" }}>Could not load property data.</p>
        )}

        {!loading && !error && data && (
          <div className="agent-reveal-in">
          <p className="text-[11px] mb-3 italic" style={{ color: "var(--agent-text-muted)" }}>
            Data sourced from Land Registry and EPC Register. Always verify before use.
          </p>
          <div className="space-y-4">

            {/* Price paid history */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--agent-text-muted)" }}>
                Price Paid History
              </p>
              {data.pricePaid.length === 0 ? (
                <p className="text-sm italic" style={{ color: "var(--agent-text-muted)" }}>No sales found for this postcode.</p>
              ) : (
                <div className="space-y-2">
                  {data.pricePaid.slice(0, 5).map((entry, i) => (
                    <div key={i} className="agent-hover-row rounded-md px-1 -mx-1 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs flex-shrink-0" style={{ color: "var(--agent-text-muted)" }}>{fmtDate(entry.date)}</span>
                        <span className="text-sm font-semibold" style={{ color: "var(--agent-text-primary)" }}>
                          {entry.amount > 0 ? fmt(entry.amount * 100) : "—"}
                        </span>
                      </div>
                      <span className="text-xs flex-shrink-0 ml-3" style={{ color: "var(--agent-text-muted)" }}>
                        {entry.propertyType}{entry.newBuild ? " · New build" : ""}{entry.estateType ? ` · ${entry.estateType}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EPC */}
            <div className="pt-4" style={{ borderTop: "0.5px solid var(--agent-border-default)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--agent-text-muted)" }}>EPC</p>
              {data.epc ? (
                <div className="space-y-2">
                  {data.address && (
                    <p className="text-xs" style={{ color: "var(--agent-text-muted)" }}>{data.address}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-lg font-bold ${EPC_COLOURS[data.epc.rating]?.bg ?? "bg-white/30"} ${EPC_COLOURS[data.epc.rating]?.text ?? "text-slate-900/80"}`}>
                        {data.epc.rating}
                      </span>
                      {data.epc.score !== null && (
                        <span className="text-xs" style={{ color: "var(--agent-text-secondary)" }}>{data.epc.score} / 100</span>
                      )}
                    </div>
                    {data.postcode && (
                      <a
                        href={`https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(data.postcode)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="agent-link"
                        style={{ fontSize: 12 }}
                      >
                        View on GOV.UK →
                      </a>
                    )}
                  </div>
                  {data.epc.inspectionDate && (
                    <p className="text-xs" style={{ color: "var(--agent-text-muted)" }}>Inspected {fmtDate(data.epc.inspectionDate)}</p>
                  )}
                </div>
              ) : data.epcConfigured ? (
                <p className="text-xs italic" style={{ color: "var(--agent-text-muted)" }}>No EPC found.</p>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--agent-text-muted)" }}>EPC data is currently unavailable.</p>
              )}
            </div>

          </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
