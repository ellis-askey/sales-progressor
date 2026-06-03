"use client";
// Per-agency fee management.
//
// Pick an agency, see its current setting, toggle between standard (sliding
// scale £250/£300/£350) and legacy (fixed amount), enter the fixed amount,
// save. On save the page revalidates and the row below the form updates.
//
// All other agencies + their current settings live in a table beneath the
// form for visibility.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react";
import { PriceInput } from "@/components/ui/PriceInput";
import { saveAgencyFeeAction } from "@/app/actions/agency-fees";
import type { ClientType } from "@prisma/client";

type AgencyRow = {
  id: string;
  name: string;
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
  // True when the agency has a Stripe customer on file (any card saved).
  // Drives the "Card" column on the table — green CheckCircle when true,
  // muted-grey CheckCircle when false.
  hasActiveCard: boolean;
  transactionCount: number;
};

type Props = {
  agencies: AgencyRow[];
  legacyCount: number;
  totalCount: number;
};

export function AgencyFeeCard({ agencies, legacyCount, totalCount }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>("");
  const [feeTier, setFeeTier] = useState<ClientType>("standard");
  const [legacyPence, setLegacyPence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectAgency(id: string) {
    setSelectedId(id);
    setError(null);
    const a = agencies.find((x) => x.id === id);
    if (a) {
      setFeeTier(a.feeTier);
      setLegacyPence(a.legacyOutsourcedFeePence);
    } else {
      setFeeTier("standard");
      setLegacyPence(null);
    }
  }

  function save() {
    if (!selectedId) return;
    if (feeTier === "legacy" && (legacyPence == null || legacyPence <= 0)) {
      setError("Enter a positive amount for the legacy fee.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveAgencyFeeAction({
        agencyId: selectedId,
        feeTier,
        legacyOutsourcedFeePence: feeTier === "legacy" ? legacyPence : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const selected = agencies.find((a) => a.id === selectedId) ?? null;
  const standardCount = totalCount - legacyCount;

  return (
    <div className="glass-card rounded-[12px] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Agency fees</p>
          <p className="agent-card-subtitle">
            Per-agency override for outsourced files. Self-managed stays £59 regardless.
            Standard agencies use the sliding scale: under £350k → £250, £350k–£499k → £300, £500k+ → £350.
          </p>
        </div>
        <div className="text-xs text-slate-900/50 text-right flex-shrink-0">
          <p><span className="font-semibold text-slate-900/80">{standardCount}</span> on sliding scale</p>
          <p><span className="font-semibold text-slate-900/80">{legacyCount}</span> on legacy fixed</p>
        </div>
      </div>

      {/* Form row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-3 mb-5">
        <label className="block">
          <span className="text-xs font-medium text-slate-900/50 block mb-1">Agency</span>
          <select
            value={selectedId}
            onChange={(e) => selectAgency(e.target.value)}
            className="glass-input w-full px-3 py-2 text-sm"
            disabled={isPending}
          >
            <option value="">Select an agency…</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.feeTier === "legacy" ? `— legacy ${a.legacyOutsourcedFeePence != null ? formatGBP(a.legacyOutsourcedFeePence) : "(unset)"}` : "— sliding"}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-xs font-medium text-slate-900/50 block mb-1">Fee type</span>
          <div className="flex items-center gap-1 glass-subtle p-1 w-fit rounded-md">
            {(["standard", "legacy"] as ClientType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFeeTier(t)}
                disabled={!selectedId || isPending}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                  feeTier === t
                    ? "bg-white/60 text-slate-900/90 shadow-sm"
                    : "text-slate-900/50 hover:text-slate-900/70 disabled:opacity-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className={feeTier === "legacy" ? "" : "opacity-40 pointer-events-none"}>
          <span className="text-xs font-medium text-slate-900/50 block mb-1">Legacy fee</span>
          <div className="w-32">
            <PriceInput
              value={legacyPence}
              onChange={setLegacyPence}
              size="sm"
              placeholder="220"
              disabled={!selectedId || feeTier !== "legacy" || isPending}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!selectedId || isPending}
          className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#FF6B4A" }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-500">{error}</p>
      )}

      {selected && (
        <p className="mb-4 text-xs text-slate-900/50">
          {selected.name} has {selected.transactionCount} file{selected.transactionCount === 1 ? "" : "s"} on
          the platform. {feeTier === "legacy"
            ? "After save: every outsourced exchange will charge the fixed amount above."
            : "After save: outsourced exchanges fall back to the sliding scale based on purchase price."}
        </p>
      )}

      {/* Current settings table */}
      <div className="glass-card overflow-hidden" style={{ borderRadius: 10 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/20 bg-white/10">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Agency</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-900/40">Fee tier</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-900/40">Legacy fee</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Card</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-900/40">Files</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/15">
            {agencies.map((a) => (
              <tr
                key={a.id}
                onClick={() => selectAgency(a.id)}
                className={`cursor-pointer transition-colors ${a.id === selectedId ? "bg-coral-50/40" : "hover:bg-white/5"}`}
              >
                <td className="px-4 py-2.5 text-slate-900/80">{a.name}</td>
                <td className="px-3 py-2.5 text-xs">
                  {a.feeTier === "legacy" ? (
                    <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Legacy</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-slate-900/60">Sliding</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-xs text-slate-900/70 font-mono">
                  {a.feeTier === "legacy"
                    ? (a.legacyOutsourcedFeePence != null ? formatGBP(a.legacyOutsourcedFeePence) : <span className="text-red-500 italic">unset</span>)
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <CheckCircle
                    size={16}
                    weight={a.hasActiveCard ? "fill" : "regular"}
                    color={a.hasActiveCard ? "var(--agent-success, #10b981)" : "rgba(15,23,42,0.20)"}
                    aria-label={a.hasActiveCard ? "Card saved" : "No card on file"}
                  />
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-slate-900/50">{a.transactionCount}</td>
              </tr>
            ))}
            {agencies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-900/40 italic">
                  No agencies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatGBP(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
