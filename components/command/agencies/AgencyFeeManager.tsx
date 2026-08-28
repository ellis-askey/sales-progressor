"use client";

// Command Centre → Agencies & agents → Agency fees.
//
// Per-agency fee override for outsourced files. Pick an agency, toggle between
// the standard sliding scale (£250/£300/£350) and a legacy fixed amount, enter
// the amount, save. Reuses saveAgencyFeeAction — same server logic as the old
// /agent/admin card, restyled for the Command Centre dark surface.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAgencyFeeAction } from "@/app/actions/agency-fees";
import type { ClientType } from "@prisma/client";

export type AgencyFeeRow = {
  id: string;
  name: string;
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
  hasActiveCard: boolean;
  transactionCount: number;
};

function fmtGBP(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

export function AgencyFeeManager({
  agencies,
  legacyCount,
  freeCount,
  totalCount,
}: {
  agencies: AgencyFeeRow[];
  legacyCount: number;
  freeCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>("");
  const [feeTier, setFeeTier] = useState<ClientType>("standard");
  const [legacyPounds, setLegacyPounds] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectAgency(id: string) {
    setSelectedId(id);
    setError(null);
    const a = agencies.find((x) => x.id === id);
    if (a) {
      setFeeTier(a.feeTier);
      setLegacyPounds(a.legacyOutsourcedFeePence != null ? String(Math.round(a.legacyOutsourcedFeePence / 100)) : "");
    } else {
      setFeeTier("standard");
      setLegacyPounds("");
    }
  }

  function save() {
    if (!selectedId) return;
    const pence = legacyPounds.trim() ? Math.round(Number(legacyPounds) * 100) : null;
    if (feeTier === "legacy" && (pence == null || !Number.isFinite(pence) || pence <= 0)) {
      setError("Enter a positive amount for the legacy fee.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveAgencyFeeAction({
        agencyId: selectedId,
        feeTier,
        legacyOutsourcedFeePence: feeTier === "legacy" ? pence : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const selected = agencies.find((a) => a.id === selectedId) ?? null;
  const standardCount = totalCount - legacyCount - freeCount;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Agency fees</h2>
          <p className="text-[12px] text-neutral-500 mt-1 max-w-2xl leading-relaxed">
            Per-agency override. Self-managed is £59 unless the agency is set to free. Standard agencies
            use the sliding scale: under £350k → £250, £350k&ndash;£499k → £300, £500k+ → £350.
          </p>
        </div>
        <div className="text-[11px] text-neutral-500 text-right shrink-0 tabular-nums">
          <p><span className="font-semibold text-neutral-200">{standardCount}</span> on sliding scale</p>
          <p><span className="font-semibold text-neutral-200">{legacyCount}</span> on legacy fixed</p>
          {freeCount > 0 && <p><span className="font-semibold text-neutral-200">{freeCount}</span> free</p>}
        </div>
      </div>

      {/* Form row */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex-1 min-w-[220px]">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Agency</span>
          <select
            value={selectedId}
            onChange={(e) => selectAgency(e.target.value)}
            disabled={isPending}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-neutral-100 outline-none focus:border-blue-700 disabled:opacity-50"
          >
            <option value="">Select an agency…</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.feeTier === "legacy" ? `(legacy ${a.legacyOutsourcedFeePence != null ? fmtGBP(a.legacyOutsourcedFeePence) : "unset"})` : a.feeTier === "free" ? "(free)" : "(sliding)"}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Fee type</span>
          <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-[3px]">
            {(["standard", "legacy", "free"] as ClientType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFeeTier(t)}
                disabled={!selectedId || isPending}
                className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-md capitalize transition-colors disabled:opacity-40 ${
                  feeTier === t ? "bg-blue-950/50 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.4)]" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className={feeTier === "legacy" ? "" : "opacity-40 pointer-events-none"}>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Legacy fee</span>
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg px-3 w-32 focus-within:border-blue-700">
            <span className="text-neutral-500 text-[13px]">£</span>
            <input
              inputMode="numeric"
              value={legacyPounds}
              onChange={(e) => setLegacyPounds(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="220"
              disabled={!selectedId || feeTier !== "legacy" || isPending}
              className="w-full bg-transparent py-2 pl-1 text-[13px] text-neutral-100 outline-none tabular-nums placeholder:text-neutral-600"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!selectedId || isPending}
          className="bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {selected && (
        <p className="mb-4 text-[12px] text-neutral-500">
          {selected.name} has {selected.transactionCount} file{selected.transactionCount === 1 ? "" : "s"} on the platform.{" "}
          {feeTier === "free"
            ? "After save: this agency is free. No self-managed fee on any file, and its existing open files are freed too."
            : feeTier === "legacy"
              ? "After save: every outsourced exchange charges the fixed amount above."
              : "After save: outsourced exchanges fall back to the sliding scale based on purchase price."}
        </p>
      )}

      {/* Current settings table */}
      <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/40">
        <table className="w-full text-[13px] min-w-[520px]">
          <thead>
            <tr className="bg-neutral-950/60">
              <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Agency</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Fee tier</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Legacy fee</th>
              <th className="text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Card</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Files</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {agencies.map((a) => (
              <tr
                key={a.id}
                onClick={() => selectAgency(a.id)}
                className={`cursor-pointer transition-colors ${a.id === selectedId ? "bg-blue-950/30" : "hover:bg-neutral-900"}`}
              >
                <td className="px-4 py-2.5 text-neutral-200">{a.name}</td>
                <td className="px-3 py-2.5">
                  {a.feeTier === "legacy" ? (
                    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border text-amber-400 bg-amber-950/50 border-amber-900">Legacy</span>
                  ) : a.feeTier === "free" ? (
                    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-950/50 border-emerald-900">Free</span>
                  ) : (
                    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border text-neutral-400 bg-neutral-800/60 border-neutral-700">Sliding</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-mono text-neutral-300 tabular-nums">
                  {a.feeTier === "legacy"
                    ? a.legacyOutsourcedFeePence != null
                      ? fmtGBP(a.legacyOutsourcedFeePence)
                      : <span className="text-red-400 italic">unset</span>
                    : <span className="text-neutral-700">·</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={a.hasActiveCard ? "text-emerald-400" : "text-neutral-700"} aria-label={a.hasActiveCard ? "Card saved" : "No card on file"}>
                    {a.hasActiveCard ? "✓" : "·"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-neutral-500 tabular-nums">{a.transactionCount}</td>
              </tr>
            ))}
            {agencies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-500 italic">No agencies yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
