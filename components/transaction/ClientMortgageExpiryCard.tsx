// Client-supplied mortgage-offer expiry on the property-file Overview (Batch 3,
// 2026-08-17). Surfaces the buyer's mortgage-offer expiry (and the seller's
// onward-purchase one, when they're buying onward) so the progressor can see a
// lapsing offer before it blows a completion. Renders nothing until a client
// has entered a date in their portal Information tab. Amber within 21 days.

import { getFileMoveDates } from "@/lib/services/portal-info";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86_400_000);
}

function Row({ label, iso }: { label: string; iso: string }) {
  const days = daysUntil(iso);
  const soon = days <= 21;
  const past = days < 0;
  const tone = past ? "#DC2626" : soon ? "#B45309" : "rgba(15,23,42,0.55)";
  const note = past ? "Expired" : days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} away`;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.4)" }}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900/80">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: tone }}>{fmt(iso)} · {note}</p>
      </div>
      {(soon || past) && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: past ? "rgba(220,38,38,0.12)" : "rgba(180,83,9,0.12)", color: tone }}>
          {past ? "Expired" : "Soon"}
        </span>
      )}
    </div>
  );
}

export async function ClientMortgageExpiryCard({ transactionId }: { transactionId: string }) {
  const d = await getFileMoveDates(transactionId);
  if (!d.buyerMortgageExpiry && !d.sellerOnwardMortgageExpiry) return null;

  return (
    <div className="glass-card p-5">
      <p className="glass-section-label text-slate-900/40 mb-3">Mortgage offer expiry</p>
      <div className="space-y-2">
        {d.buyerMortgageExpiry && <Row label="Buyer's mortgage offer" iso={d.buyerMortgageExpiry} />}
        {d.sellerOnwardMortgageExpiry && <Row label="Seller's onward mortgage offer" iso={d.sellerOnwardMortgageExpiry} />}
      </div>
      <p className="text-xs text-slate-900/40 mt-3">Supplied by the client in their portal.</p>
    </div>
  );
}
