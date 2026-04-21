"use client";

import type { ChainData, ChainLinkData } from "@/lib/services/chains";

function daysStuck(link: ChainLinkData): number | null {
  if (!link.transaction) return null;
  const last = link.transaction.milestoneCompletions[0]?.completedAt;
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
}

function linkRisk(link: ChainLinkData): "high" | "medium" | "low" {
  if (!link.transaction) {
    const s = link.externalStatus?.toLowerCase() ?? "";
    if (s === "at risk" || s === "high") return "high";
    if (s === "slow") return "medium";
    return "low";
  }
  const stuck = daysStuck(link);
  if (link.transaction.status === "on_hold" || (stuck !== null && stuck >= 21)) return "high";
  if (stuck !== null && stuck >= 10) return "medium";
  return "low";
}

const RISK_DOT: Record<string, string> = {
  high:   "bg-red-400 ring-2 ring-red-200",
  medium: "bg-amber-400 ring-2 ring-amber-200",
  low:    "bg-emerald-400",
};

const RISK_BORDER: Record<string, string> = {
  high:   "border-red-200 bg-red-50",
  medium: "border-amber-200 bg-amber-50",
  low:    "border-white/20 bg-white/10",
};

function LinkCard({ link, isThis, isWeakest }: { link: ChainLinkData; isThis: boolean; isWeakest: boolean }) {
  const risk = linkRisk(link);
  const stuck = daysStuck(link);
  const address = link.transaction?.propertyAddress ?? link.externalAddress ?? "External property";
  const [line1, ...rest] = address.split(",");
  const line2 = rest.join(",").trim();

  return (
    <div className={`relative border rounded-xl px-4 py-3 transition-all ${RISK_BORDER[risk]} ${
      isThis ? "ring-2 ring-blue-300" : ""
    }`}>
      {isThis && (
        <span className="absolute -top-2.5 left-4 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
          This file
        </span>
      )}
      {isWeakest && (
        <span className="absolute -top-2.5 right-4 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
          Weakest link
        </span>
      )}

      <div className="flex items-start gap-3">
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${RISK_DOT[risk]}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900/90 leading-snug truncate">{line1}</p>
          {line2 && <p className="text-xs text-slate-900/40 mt-0.5 truncate">{line2}</p>}

          {link.transaction ? (
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {stuck !== null && (
                <span className={`text-xs ${stuck >= 21 ? "text-red-600 font-medium" : stuck >= 10 ? "text-amber-600" : "text-slate-900/40"}`}>
                  {stuck === 0 ? "Active today" : `${stuck}d since last milestone`}
                </span>
              )}
              {link.transaction.vendorSolicitorFirm && (
                <span className="text-xs text-slate-900/40">
                  V: {link.transaction.vendorSolicitorFirm.name}
                </span>
              )}
              {link.transaction.purchaserSolicitorFirm && (
                <span className="text-xs text-slate-900/40">
                  P: {link.transaction.purchaserSolicitorFirm.name}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1.5">
              <span className="text-xs text-slate-900/40 italic">
                {link.externalStatus ?? "External — status unknown"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChainConnector() {
  return (
    <div className="flex items-center justify-center h-6">
      <div className="flex flex-col items-center gap-0.5">
        <span className="w-px h-2 bg-white/30" />
        <svg className="w-3.5 h-3.5 text-slate-900/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}

export function ChainMap({ chain, currentTransactionId }: { chain: ChainData; currentTransactionId: string }) {
  const links = [...chain.links].sort((a, b) => a.position - b.position);

  // Find weakest link (highest risk, excluding "this" file if only one)
  const risked = links.map((l) => ({ link: l, risk: linkRisk(l) }));
  const order = { high: 0, medium: 1, low: 2 };
  const weakest = [...risked].sort((a, b) => order[a.risk] - order[b.risk])[0];
  const weakestId = weakest?.risk !== "low" ? weakest?.link.id : null;

  return (
    <div className="space-y-0">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">
          Chain · {links.length} link{links.length !== 1 ? "s" : ""}
        </p>
        {weakestId && (
          <p className="text-xs text-red-600 font-medium">
            ⚠ Weakest link identified
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {links.map((link, i) => (
          <div key={link.id}>
            <LinkCard
              link={link}
              isThis={link.transactionId === currentTransactionId}
              isWeakest={link.id === weakestId}
            />
            {i < links.length - 1 && <ChainConnector />}
          </div>
        ))}
      </div>
    </div>
  );
}
