"use client";

import { useEffect, useState } from "react";

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
  D: { bg: "bg-yellow-400", text: "text-gray-800" },
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
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [transactionId]);

  return (
    <div className="bg-white rounded-xl border border-[#e4e9f0]"
         style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div className="px-5 py-4 border-b border-[#f0f4f8] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Property Intel</p>
          <p className="text-xs text-gray-400 mt-0.5">
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
               className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors">
              Land Reg
            </a>
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {loading && (
          <p className="text-sm text-gray-300 text-center py-4">Fetching property data…</p>
        )}

        {error && (
          <p className="text-sm text-gray-400 text-center py-4">Could not load property data.</p>
        )}

        {!loading && !error && data && (
          <div className="flex gap-6">

            {/* Price paid history */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Price Paid History
              </p>
              {data.pricePaid.length === 0 ? (
                <p className="text-sm text-gray-300 italic">No sales found for this postcode.</p>
              ) : (
                <div className="space-y-2">
                  {data.pricePaid.slice(0, 5).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">
                          {entry.amount > 0 ? fmt(entry.amount * 100) : "—"}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">
                          {entry.propertyType}{entry.newBuild ? " · New build" : ""}
                          {entry.estateType ? ` · ${entry.estateType}` : ""}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                        {fmtDate(entry.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EPC */}
            <div className="w-44 flex-shrink-0 border-l border-[#f0f4f8] pl-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">EPC</p>
              {data.epc ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-lg font-bold ${EPC_COLOURS[data.epc.rating]?.bg ?? "bg-gray-200"} ${EPC_COLOURS[data.epc.rating]?.text ?? "text-gray-800"}`}>
                      {data.epc.rating}
                    </span>
                    {data.epc.score !== null && (
                      <span className="text-xs text-gray-500">{data.epc.score} / 100</span>
                    )}
                  </div>
                  {data.epc.propertyType && (
                    <p className="text-xs text-gray-500">{data.epc.propertyType}{data.epc.builtForm ? ` · ${data.epc.builtForm}` : ""}</p>
                  )}
                  {data.epc.floorArea && (
                    <p className="text-xs text-gray-500">{data.epc.floorArea} m²</p>
                  )}
                  {data.epc.inspectionDate && (
                    <p className="text-xs text-gray-400">Inspected {fmtDate(data.epc.inspectionDate)}</p>
                  )}
                </div>
              ) : data.epcConfigured ? (
                <p className="text-xs text-gray-300 italic">No EPC found.</p>
              ) : (
                <div>
                  <p className="text-xs text-gray-400 leading-relaxed">Add <code className="bg-gray-100 px-1 rounded">EPC_API_EMAIL</code> and <code className="bg-gray-100 px-1 rounded">EPC_API_KEY</code> to .env.local to enable.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
