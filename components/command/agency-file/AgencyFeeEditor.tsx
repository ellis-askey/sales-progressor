"use client";

// Command Centre → Agency File → Money & billing → fee tier.
//
// Per-agency fee editing on the agency's own page: the same standard / legacy /
// free control the Agencies list offered, scoped to this one agency. Reuses
// saveAgencyFeeAction (including its retroactive free-tier behaviour).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAgencyFeeAction } from "@/app/actions/agency-fees";
import type { ClientType } from "@prisma/client";

function fmtGBP(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

export function AgencyFeeEditor({
  agencyId,
  feeTier,
  legacyOutsourcedFeePence,
}: {
  agencyId: string;
  feeTier: ClientType;
  legacyOutsourcedFeePence: number | null;
}) {
  const router = useRouter();
  const [tier, setTier] = useState<ClientType>(feeTier);
  const [legacyPounds, setLegacyPounds] = useState<string>(
    legacyOutsourcedFeePence != null ? String(Math.round(legacyOutsourcedFeePence / 100)) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty =
    tier !== feeTier ||
    (tier === "legacy" &&
      (legacyPounds.trim() ? Math.round(Number(legacyPounds) * 100) : null) !== legacyOutsourcedFeePence);

  function save() {
    const pence = legacyPounds.trim() ? Math.round(Number(legacyPounds) * 100) : null;
    if (tier === "legacy" && (pence == null || !Number.isFinite(pence) || pence <= 0)) {
      setError("Enter a positive amount for the legacy fee.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveAgencyFeeAction({
        agencyId,
        feeTier: tier,
        legacyOutsourcedFeePence: tier === "legacy" ? pence : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-3 text-xs mb-2">
        <span className="text-neutral-400 flex-shrink-0">Fee tier</span>
        <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg p-[2px]">
          {(["standard", "legacy", "free"] as ClientType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTier(t); setError(null); }}
              disabled={isPending}
              className={`text-[11px] font-semibold px-2 py-1 rounded-md capitalize transition-colors disabled:opacity-40 ${
                tier === t
                  ? "bg-blue-950/50 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.4)]"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tier === "legacy" && (
        <div className="flex items-center justify-between gap-3 text-xs mb-2">
          <span className="text-neutral-400 flex-shrink-0">Legacy fee per sale</span>
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg px-2 w-24 focus-within:border-blue-700">
            <span className="text-neutral-500 text-[12px]">£</span>
            <input
              inputMode="numeric"
              value={legacyPounds}
              onChange={(e) => setLegacyPounds(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="220"
              disabled={isPending}
              className="w-full bg-transparent py-1.5 pl-1 text-[12px] text-neutral-100 outline-none tabular-nums placeholder:text-neutral-600"
            />
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-600 leading-relaxed mb-2">
        {tier === "free"
          ? "Free comps every outsourced file, including existing open ones."
          : tier === "legacy"
            ? "Every outsourced exchange charges the fixed amount."
            : "Sliding scale by purchase price: under £350k → £250, £350k to £499k → £300, £500k+ → £350."}
      </p>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {(dirty || saved) && (
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="bg-blue-600 hover:bg-blue-500 text-white text-[11.5px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save fee tier"}
        </button>
      )}
    </div>
  );
}
