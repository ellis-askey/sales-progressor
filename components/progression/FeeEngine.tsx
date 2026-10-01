"use client";

// The fee engine: a progressor sets HOW they charge a client (flat / tiered by
// price / % of price); every sale auto-prices into the fees figures. Saves the
// rate card to ProgressionBusinessClient.feeModel via setClientFeeModelAction.
// Hero card with the coral top accent; agent tokens, no icon backers, both themes.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Button } from "@/components/ui/Button";
import { fmtCurrencyPence } from "@/lib/utils";
import { setClientFeeModelAction } from "@/app/actions/progression-clients";
import {
  calculateClientFee, DEFAULT_TIERS, type ClientFeeModel, type TieredBand,
} from "@/lib/progression/client-fees";

const TYPES = [
  ["flat", "Flat per sale"],
  ["tiered", "Tiered by price"],
  ["percent", "% of price"],
] as const;

const DEF: Record<string, ClientFeeModel> = {
  flat: { type: "flat", pence: 30000 },
  percent: { type: "percent", bps: 30 },
  tiered: { type: "tiered", bands: DEFAULT_TIERS },
};

// Small money input: shows pounds, stores pence.
function Money({ pence, onChange, width = 110 }: { pence: number; onChange: (p: number) => void; width?: number }) {
  return (
    <span className="fe-money" style={{ width }}>
      <span className="sym">£</span>
      <input
        type="number" min={0} inputMode="numeric" value={pence / 100}
        onChange={(e) => onChange(Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)))}
      />
    </span>
  );
}

export function FeeEngine({
  agencyId, name, initial, fees,
}: {
  agencyId: string;
  name: string;
  initial: ClientFeeModel | null;
  fees: { earnedPence: number; pipelinePence: number; thisMonthPence: number; avgPence: number | null };
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [saved, setSaved] = useState<ClientFeeModel>(initial ?? DEF.flat);
  const [model, setModel] = useState<ClientFeeModel>(initial ?? DEF.flat);
  const [previewPounds, setPreviewPounds] = useState(450000);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(model) !== JSON.stringify(saved);
  const previewFee = calculateClientFee(model, Math.round(previewPounds * 100));

  function setType(type: string) {
    if (type === model.type) return;
    setModel(DEF[type]);
  }
  function setBands(bands: TieredBand[]) { setModel({ type: "tiered", bands }); }

  async function save() {
    setSaving(true);
    const res = await setClientFeeModelAction(agencyId, model);
    setSaving(false);
    if (res.ok) {
      setSaved(model);
      toast.success("Rate card saved", { description: `Fees for ${name} now use this.` });
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const tiered = model.type === "tiered" ? model : null;
  const lastBounded = tiered ? [...tiered.bands].filter((b) => b.uptoPence != null).sort((a, b) => (a.uptoPence! - b.uptoPence!)).slice(-1)[0] : null;

  return (
    <div className="fe">
      <div className="fe-top">
        <div>
          <p className="fe-eyebrow">Rate card</p>
          <h3 className="fe-h">How you charge {name}</h3>
        </div>
        <Button variant="primary" size="sm" className="fe-save" onClick={save} disabled={!dirty} loading={saving}>
          {dirty ? "Save rate card" : "Saved"}
        </Button>
      </div>
      <p className="fe-sub">Set it once; every sale you progress for them auto-prices into pipeline, this month and fees earned. Changing it only affects future sales.</p>

      <div className="fe-seg">
        {TYPES.map(([t, label]) => (
          <button key={t} type="button" className={`fe-segb ${t === model.type ? "on" : ""}`} onClick={() => setType(t)}>{label}</button>
        ))}
      </div>

      <div className="fe-grid">
        <div className="fe-editor">
          {model.type === "flat" && (
            <div className="fe-flat"><Money pence={model.pence} onChange={(pence) => setModel({ type: "flat", pence })} /><span className="fe-unit">per exchanged sale</span></div>
          )}

          {model.type === "percent" && (
            <div className="fe-flat">
              <span className="fe-money" style={{ width: 92 }}>
                <input type="number" min={0} max={100} step={0.05} value={model.bps / 100}
                  onChange={(e) => setModel({ type: "percent", bps: Math.max(0, Math.min(10000, Math.round((parseFloat(e.target.value) || 0) * 100))) })} />
                <span className="sym pct">%</span>
              </span>
              <span className="fe-unit">of the purchase price</span>
            </div>
          )}

          {tiered && (
            <div className="fe-bands">
              {tiered.bands.map((b, i) => (
                <div className="fe-band" key={i}>
                  {b.uptoPence == null
                    ? <span className="fe-band-th">Over {lastBounded ? fmtCurrencyPence(lastBounded.uptoPence!) : "£0"}</span>
                    : <span className="fe-band-th">Up to <Money pence={b.uptoPence} width={118} onChange={(p) => setBands(tiered.bands.map((x, j) => j === i ? { ...x, uptoPence: p } : x))} /></span>}
                  <span className="fe-arrow">→</span>
                  <Money pence={b.pence} width={96} onChange={(p) => setBands(tiered.bands.map((x, j) => j === i ? { ...x, pence: p } : x))} />
                  {b.uptoPence != null && tiered.bands.length > 1 && (
                    <button type="button" className="fe-rm" aria-label="Remove band" onClick={() => setBands(tiered.bands.filter((_, j) => j !== i))}>×</button>
                  )}
                </div>
              ))}
              <button type="button" className="fe-addband" onClick={() => {
                const maxTh = lastBounded?.uptoPence ?? 30000000;
                const newBand: TieredBand = { uptoPence: maxTh + 25000000, pence: (lastBounded?.pence ?? 25000) + 10000 };
                const bounded = tiered.bands.filter((x) => x.uptoPence != null);
                const unbounded = tiered.bands.filter((x) => x.uptoPence == null);
                setBands([...bounded, newBand, ...unbounded]);
              }}>+ Add a price band</button>
            </div>
          )}
        </div>

        <div className="fe-preview">
          <div className="fe-pk">Fee preview</div>
          <div className="fe-prow">
            <span className="fe-money" style={{ width: 130 }}><span className="sym">£</span>
              <input type="number" min={0} step={10000} value={previewPounds} onChange={(e) => setPreviewPounds(Math.max(0, Math.round(parseFloat(e.target.value) || 0)))} />
            </span>
            <span className="fe-arrow big">→</span>
            <span className="fe-pfee">{fmtCurrencyPence(previewFee ?? 0)}</span>
          </div>
          <div className="fe-pcap">A sale at that price earns you this fee.</div>
        </div>
      </div>

      <div className="fe-foot">
        <div className="m"><div className="v">{fmtCurrencyPence(fees.earnedPence)}</div><div className="l">Fees earned</div></div>
        <div className="m"><div className="v">{fmtCurrencyPence(fees.pipelinePence)}</div><div className="l">In pipeline</div></div>
        <div className="m"><div className="v">{fmtCurrencyPence(fees.thisMonthPence)}</div><div className="l">This month</div></div>
        <div className="m"><div className="v">{fees.avgPence == null ? "n/a" : fmtCurrencyPence(fees.avgPence)}</div><div className="l">Avg / sale</div></div>
      </div>

      <style>{`
        .fe { position: relative; overflow: hidden; border-radius: 16px; padding: 20px; margin-bottom: 16px;
          background: var(--agent-glass-bg, rgba(255,255,255,0.5)); border: 1px solid rgba(var(--agent-coral-rgb),0.3);
          -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
          box-shadow: 0 18px 44px -26px rgba(40,26,20,0.3);
          animation: fe-in .5s cubic-bezier(.22,1,.36,1) both; }
        .fe::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: linear-gradient(90deg, var(--agent-coral), var(--agent-coral-deep)); }
        @keyframes fe-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
        .fe-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .fe-eyebrow { margin: 0 0 3px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--agent-coral-ink, #BE3C1C); }
        .fe-h { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; color: var(--agent-text-primary); }
        .fe-save { gap: 6px; background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 14px -4px rgba(var(--agent-coral-rgb),0.4); }
        .fe-save:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); }
        .fe-save:active:not(:disabled) { transform: scale(.98); }
        .fe-sub { margin: 8px 0 16px; font-size: 12.5px; color: var(--agent-text-secondary); max-width: 64ch; }

        .fe-seg { display: inline-flex; background: var(--agent-glass-bg, rgba(0,0,0,0.04)); border: 1px solid var(--agent-border-subtle); border-radius: 11px; padding: 3px; gap: 2px; margin-bottom: 18px; flex-wrap: wrap; }
        .fe-segb { appearance: none; border: none; cursor: pointer; font-size: 12.5px; font-weight: 650; padding: 8px 14px; border-radius: 8px; color: var(--agent-text-muted); background: none; transition: background .15s, color .15s; }
        .fe-segb:hover { color: var(--agent-text-primary); }
        .fe-segb.on { background: var(--agent-panel, #fff); color: var(--agent-coral-ink, #BE3C1C); box-shadow: 0 2px 6px -3px rgba(40,26,20,0.3); }
        :root[data-theme="dark"] .fe-segb.on { background: rgba(255,255,255,0.1); }

        .fe-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 720px) { .fe-grid { grid-template-columns: 1fr; } }

        .fe-money { display: inline-flex; align-items: center; border: 1px solid var(--agent-border-strong, var(--agent-border-subtle)); border-radius: 9px; background: var(--agent-panel, rgba(255,255,255,0.7)); overflow: hidden; transition: border-color .15s, box-shadow .15s; }
        :root[data-theme="dark"] .fe-money { background: rgba(255,255,255,0.05); }
        .fe-money:focus-within { border-color: var(--agent-coral-deep); box-shadow: 0 0 0 3px rgba(var(--agent-coral-rgb),0.14); }
        .fe-money .sym { padding: 0 2px 0 11px; font-size: 13px; color: var(--agent-text-muted); font-weight: 600; }
        .fe-money .sym.pct { padding: 0 11px 0 2px; order: 2; }
        .fe-money input { border: none; outline: none; background: none; font: inherit; font-size: 14px; font-weight: 700; color: var(--agent-text-primary); width: 100%; padding: 9px 11px 9px 4px; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
        .fe-money input::-webkit-outer-spin-button, .fe-money input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        .fe-flat { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .fe-unit { font-size: 13px; color: var(--agent-text-secondary); }

        .fe-bands { display: flex; flex-direction: column; gap: 9px; }
        .fe-band { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .fe-band-th { font-size: 13px; color: var(--agent-text-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 7px; min-width: 120px; }
        .fe-arrow { color: var(--agent-text-muted); font-weight: 700; }
        .fe-arrow.big { font-size: 18px; }
        .fe-rm { appearance: none; border: none; background: none; cursor: pointer; color: var(--agent-text-muted); font-size: 17px; line-height: 1; padding: 2px 4px; border-radius: 6px; }
        .fe-rm:hover { color: var(--agent-coral-deep); background: rgba(var(--agent-coral-rgb),0.1); }
        .fe-addband { appearance: none; border: none; background: none; cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--agent-coral-ink, #BE3C1C); padding: 4px 0; text-align: left; }
        .fe-addband:hover { text-decoration: underline; }

        .fe-preview { background: linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.1), transparent); border: 1px solid rgba(var(--agent-coral-rgb),0.25); border-radius: 13px; padding: 16px; }
        .fe-pk { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--agent-text-muted); font-weight: 600; margin-bottom: 12px; }
        .fe-prow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .fe-pfee { font-size: 26px; font-weight: 840; letter-spacing: -0.03em; color: var(--agent-coral-deep, #E2452A); font-variant-numeric: tabular-nums; }
        .fe-pcap { font-size: 11.5px; color: var(--agent-text-muted); margin-top: 10px; }

        .fe-foot { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--agent-border-subtle); }
        .fe-foot .m .v { font-size: 20px; font-weight: 820; letter-spacing: -0.02em; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }
        .fe-foot .m .l { font-size: 10.5px; color: var(--agent-text-muted); margin-top: 3px; }

        @media (prefers-reduced-motion: reduce) { .fe { animation: none; } .fe-save, .fe-money, .fe-segb { transition: none; } }
      `}</style>
    </div>
  );
}
