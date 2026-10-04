"use client";

// The fee engine: a progressor sets HOW they charge a client (flat / tiered by
// price / % of price); every sale auto-prices into the fees figures. Saves the
// rate card to ProgressionBusinessClient.feeModel via setClientFeeModelAction
// (debounced auto-save, with a live "Saved" status). One unified layout for all
// three types: three option cards (canonical RadioDot + glossy orbs), then a
// coral hero band with the rate/bands on the left and a live fee calculator on
// the right (tiered + percent; flat is a constant, so no calculator). The kebab
// is the canonical RowActionsMenu. Float card, agent tokens, both themes.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, ChartBar, Percent, Coins, TrendUp, CalendarBlank, PencilSimple, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { RowActionsMenu } from "@/components/account/chrome/RowActionsMenu";
import { fmtCurrencyPence } from "@/lib/utils";
import { setClientFeeModelAction } from "@/app/actions/progression-clients";
import {
  calculateClientFee, DEFAULT_TIERS, DEFAULT_FEE_MODEL, type ClientFeeModel, type TieredBand,
} from "@/lib/progression/client-fees";

type FeeType = "flat" | "tiered" | "percent";

const TYPES: { t: FeeType; label: string; sub: string; icon: React.ReactNode }[] = [
  { t: "flat", label: "Flat per sale", sub: "One fee for every exchange", icon: <Tag size={22} weight="fill" /> },
  { t: "tiered", label: "Tiered by price", sub: "Different fees based on sale value", icon: <ChartBar size={22} weight="fill" /> },
  { t: "percent", label: "% of sale price", sub: "A percentage of the sale price", icon: <Percent size={22} weight="bold" /> },
];

const DEF: Record<FeeType, ClientFeeModel> = {
  flat: { type: "flat", pence: 30000 },
  percent: { type: "percent", bps: 30 },
  tiered: { type: "tiered", bands: DEFAULT_TIERS },
};

const fmtPct = (bps: number) => `${+(bps / 100).toFixed(2)}%`;

// Pounds with thousands separators in the field (matches how prices read
// everywhere else in the app), parsed back to a plain integer.
const fmtNum = (n: number) => (n ? n.toLocaleString("en-GB") : "");
const parseNum = (s: string) => { const d = s.replace(/[^0-9]/g, ""); return d ? parseInt(d, 10) : 0; };

// Small money input: shows pounds (comma-grouped), stores pence.
function Money({ pence, onChange, width = 120 }: { pence: number; onChange: (p: number) => void; width?: number }) {
  return (
    <span className="fe-money" style={{ width }}>
      <span className="sym">£</span>
      <input
        type="text" inputMode="numeric" value={fmtNum(pence / 100)}
        onChange={(e) => onChange(parseNum(e.target.value) * 100)}
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
  // Null = no fee set yet. We no longer pre-fill £300 as a default display (it
  // looked set but wasn't saved); the editor starts empty until a type is picked.
  const [saved, setSaved] = useState<ClientFeeModel | null>(initial);
  const [model, setModel] = useState<ClientFeeModel | null>(initial);
  const [editing, setEditing] = useState(false);
  const [previewPounds, setPreviewPounds] = useState(450000);
  const [status, setStatus] = useState<"saved" | "saving">("saved");

  // Debounced auto-save: any change to the model persists after a short pause,
  // then refreshes so the fees figures recompute. Skips the initial mount.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!model || JSON.stringify(model) === JSON.stringify(saved)) return;
    setStatus("saving");
    const id = setTimeout(async () => {
      const res = await setClientFeeModelAction(agencyId, model);
      if (res.ok) { setSaved(model); setStatus("saved"); router.refresh(); }
      else { setStatus("saved"); toast.error(res.error); }
    }, 600);
    return () => clearTimeout(id);
  }, [model, saved, agencyId, router, toast]);

  function pickType(t: FeeType) {
    if (!model || t !== model.type) { setModel(DEF[t]); setEditing(true); }
    else setEditing((e) => !e);
  }
  function setBands(bands: TieredBand[]) { setModel({ type: "tiered", bands }); }
  function resetDefault() { setModel(DEFAULT_FEE_MODEL); setEditing(false); }

  const tiered = model?.type === "tiered" ? model : null;
  const lastBounded = tiered ? [...tiered.bands].filter((b) => b.uptoPence != null).sort((a, b) => (a.uptoPence! - b.uptoPence!)).slice(-1)[0] : null;
  const previewFee = calculateClientFee(model, Math.round(previewPounds * 100));

  const applied = <div className="fe-applied"><CheckCircle size={16} weight="fill" /> Applied automatically to every new sale you add for this client.</div>;
  const editBtn = (label: string, cls = "") => (
    <button type="button" className={`fe-edit ${cls}`} onClick={() => setEditing((e) => !e)}>
      {editing ? <><CheckCircle size={15} weight="bold" /> Done</> : <><PencilSimple size={15} weight="bold" /> {label}</>}
    </button>
  );

  const calculator = (
    <div className="fe-calc">
      <div className="fe-calc-head">
        <div>
          <p className="fe-calc-k">Fee calculator</p>
          <p className="fe-calc-sub">See what you&rsquo;ll earn at different sale prices.</p>
        </div>
        {model?.type === "tiered" && editBtn("Edit bands", "sm")}
      </div>
      <div className="fe-calc-in">
        <span className="fe-calc-lbl">Sale price</span>
        <span className="fe-money" style={{ width: 150 }}><span className="sym">£</span>
          <input type="text" inputMode="numeric" value={fmtNum(previewPounds)} onChange={(e) => setPreviewPounds(parseNum(e.target.value))} />
        </span>
      </div>
      <div className="fe-calc-out">
        <span className="fe-calc-arrow">↓</span>
        <span className="fe-calc-fee">{fmtCurrencyPence(previewFee ?? 0)}</span>
        <span className="fe-calc-cap">Fee for this sale</span>
      </div>
    </div>
  );

  return (
    <div className="fe">
      <div className="fe-top">
        <div>
          <p className="fe-eyebrow">Client rate</p>
          <h3 className="fe-h">How you charge {name}</h3>
        </div>
        <div className="fe-topright">
          <span className={`fe-status ${status}`}>
            {status === "saving" ? <CircleNotch size={15} weight="bold" className="fe-spin" /> : <CheckCircle size={15} weight="fill" />}
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
          <RowActionsMenu items={[{ label: "Reset to default rate", onClick: resetDefault }]} label="Rate options" />
        </div>
      </div>
      <p className="fe-sub">Set it once and we&rsquo;ll automatically apply it to every new sale you add for this client. You can change it at any time.</p>

      <div className="fe-cards">
        {TYPES.map(({ t, label, sub, icon }) => {
          const on = t === model?.type;
          return (
            <button key={t} type="button" role="radio" aria-checked={on} className={`fe-card ${on ? "on" : ""}`} onClick={() => pickType(t)}>
              <span className="fe-orb">{icon}</span>
              <span className="fe-ct">
                <span className="fe-cl">{label}</span>
                <span className="fe-cd">{sub}</span>
              </span>
              <span className="fe-radio" aria-hidden><span className="fe-radio-dot" /></span>
            </button>
          );
        })}
      </div>

      {/* ── Hero band: rate/bands (left) + fee calculator (right) ── */}
      {!model ? (
        <div className="fe-unset">
          <p className="fe-unset-h">No fee set yet</p>
          <p className="fe-unset-sub">Pick how you charge {name} above, then set a rate. It applies to every sale you add for them, and you&rsquo;ll need a fee set before you can add their first sale.</p>
        </div>
      ) : model.type === "flat" ? (
        <div className="fe-hero fe-hero-flat" key="flat">
          <div className="fe-rl">
            <p className="fe-rate-k">Your rate</p>
            {editing
              ? <div className="fe-flat"><Money pence={model.pence} onChange={(pence) => setModel({ type: "flat", pence })} /><span className="fe-unit">per exchanged sale</span></div>
              : <div className="fe-rate-main"><span className="fe-rate-v">{fmtCurrencyPence(model.pence)}</span><span className="fe-rate-unit">per exchanged sale</span></div>}
            {!editing && applied}
          </div>
          {editBtn("Edit rate")}
        </div>
      ) : (
        <div className="fe-hero" key={model.type}>
          <div className="fe-hero-grid">
            <div className="fe-rl">
              {model.type === "percent" ? (
                <>
                  <p className="fe-rate-k">Your rate</p>
                  {editing ? (
                    <div className="fe-flat">
                      <span className="fe-money" style={{ width: 104 }}>
                        <input type="number" min={0} max={100} step={0.05} value={model.bps / 100}
                          onChange={(e) => setModel({ type: "percent", bps: Math.max(0, Math.min(10000, Math.round((parseFloat(e.target.value) || 0) * 100))) })} />
                        <span className="sym pct">%</span>
                      </span>
                      <span className="fe-unit">of the sale price</span>
                    </div>
                  ) : (
                    <div className="fe-rate-main"><span className="fe-rate-v">{fmtPct(model.bps)}</span><span className="fe-rate-unit">of the sale price</span></div>
                  )}
                  {!editing && applied}
                  {editBtn("Edit rate", "mt")}
                </>
              ) : (
                <>
                  <p className="fe-rate-k">Your price bands</p>
                  {editing && tiered ? (
                    <div className="fe-bands">
                      {tiered.bands.map((b, i) => (
                        <div className="fe-band" key={i}>
                          {b.uptoPence == null
                            ? <span className="fe-band-th">Over {lastBounded ? fmtCurrencyPence(lastBounded.uptoPence!) : "£0"}</span>
                            : <span className="fe-band-th">Up to <Money pence={b.uptoPence} width={126} onChange={(p) => setBands(tiered.bands.map((x, j) => j === i ? { ...x, uptoPence: p } : x))} /></span>}
                          <span className="fe-arrow">→</span>
                          <Money pence={b.pence} width={104} onChange={(p) => setBands(tiered.bands.map((x, j) => j === i ? { ...x, pence: p } : x))} />
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
                  ) : tiered && (
                    <div className="fe-bandrows">
                      {tiered.bands.map((b, i) => (
                        <div className="fe-bandrow" key={i}>
                          <span className="th">{b.uptoPence == null ? `Over ${lastBounded ? fmtCurrencyPence(lastBounded.uptoPence!) : "£0"}` : `Up to ${fmtCurrencyPence(b.uptoPence)}`}</span>
                          <span className="fe-arrow">→</span>
                          <span className="amt">{fmtCurrencyPence(b.pence)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {calculator}
          </div>
        </div>
      )}

      <div className="fe-foot">
        <div className="fe-stat"><Coins size={21} weight="fill" className="ic" /><div className="body"><div className="v">{fmtCurrencyPence(fees.earnedPence)}</div><div className="l">Fees earned</div><div className="d">All time</div></div></div>
        <div className="fe-stat"><TrendUp size={21} weight="bold" className="ic" /><div className="body"><div className="v">{fmtCurrencyPence(fees.pipelinePence)}</div><div className="l">In pipeline</div><div className="d">Current sales</div></div></div>
        <div className="fe-stat"><CalendarBlank size={21} weight="fill" className="ic" /><div className="body"><div className="v">{fmtCurrencyPence(fees.thisMonthPence)}</div><div className="l">This month</div><div className="d">Exchanged</div></div></div>
        <div className="fe-stat"><ChartBar size={21} weight="fill" className="ic" /><div className="body"><div className="v">{fees.avgPence == null ? "N/A" : fmtCurrencyPence(fees.avgPence)}</div><div className="l">Average per sale</div><div className="d">Exchanged sales</div></div></div>
      </div>

      <style>{`
        /* Float: no border, lifted on a soft drop shadow (style pick). */
        .fe { position: relative; overflow: hidden; border-radius: 18px; padding: 22px; margin-bottom: 16px;
          background: var(--agent-glass-bg, rgba(255,255,255,0.5)); border: none;
          -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
          box-shadow: 0 24px 50px -28px rgba(40,26,20,0.40), 0 4px 12px -8px rgba(40,26,20,0.18);
          animation: fe-in .5s cubic-bezier(.22,1,.36,1) both; }
        :root[data-theme="dark"] .fe { box-shadow: 0 24px 50px -26px rgba(0,0,0,0.72), 0 4px 12px -8px rgba(0,0,0,0.5); }
        @keyframes fe-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }

        .fe-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .fe-eyebrow { margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--agent-coral-ink, #BE3C1C); }
        .fe-h { margin: 0; font-size: clamp(19px, 2.6vw, 24px); font-weight: 820; letter-spacing: -0.025em; color: var(--agent-text-primary); }
        .fe-topright { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .fe-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; }
        .fe-status.saved { color: var(--agent-success, #2F7D53); }
        .fe-status.saving { color: var(--agent-text-muted); }
        .fe-spin { animation: fe-spin 0.7s linear infinite; }
        @keyframes fe-spin { to { transform: rotate(360deg); } }
        .fe-sub { margin: 8px 0 18px; font-size: 13px; color: var(--agent-text-secondary); max-width: 70ch; line-height: 1.55; }

        .fe-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
        @media (max-width: 720px) { .fe-cards { grid-template-columns: 1fr; } }
        .fe-card { position: relative; display: flex; align-items: center; gap: 13px; padding: 15px 15px; border-radius: 15px;
          border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5)); cursor: pointer; text-align: left;
          transition: transform .18s cubic-bezier(.22,1,.36,1), border-color .18s, box-shadow .2s, background .22s; }
        .fe-card:hover:not(.on) { transform: translateY(-2px); border-color: var(--agent-border-default, rgba(0,0,0,0.12)); box-shadow: 0 12px 24px -16px rgba(40,26,20,0.35); }
        .fe-card:active:not(.on) { transform: translateY(0) scale(.99); }
        .fe-card.on { border-color: transparent; background: linear-gradient(145deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%);
          box-shadow: 0 14px 30px -14px rgba(var(--agent-coral-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.28); }

        .fe-orb { width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; color: var(--agent-text-secondary);
          background: linear-gradient(180deg, rgba(255,255,255,0.78), rgba(0,0,0,0.05)), var(--agent-glass-bg, #ECE7E1);
          box-shadow: inset 0 1.5px 1.5px rgba(255,255,255,0.85), inset 0 -3px 6px rgba(0,0,0,0.06), 0 3px 7px -3px rgba(40,26,20,0.14);
          transition: background .22s, color .22s, box-shadow .22s; }
        :root[data-theme="dark"] .fe-orb { background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02)); color: var(--agent-text-primary);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -3px 6px rgba(0,0,0,0.35), 0 3px 8px -3px rgba(0,0,0,0.5); }
        .fe-card.on .fe-orb { color: #fff; background: linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0.12));
          box-shadow: inset 0 1.5px 1.5px rgba(255,255,255,0.6), inset 0 -2px 6px rgba(0,0,0,0.14); }

        .fe-ct { min-width: 0; padding-right: 20px; }
        .fe-cl { display: block; font-size: 14.5px; font-weight: 750; letter-spacing: -0.01em; color: var(--agent-text-primary); }
        .fe-cd { display: block; font-size: 11.5px; color: var(--agent-text-muted); margin-top: 3px; line-height: 1.35; }
        .fe-card.on .fe-cl { color: #fff; } .fe-card.on .fe-cd { color: rgba(255,255,255,0.88); }

        .fe-radio { position: absolute; top: 14px; right: 14px; width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--agent-border-strong, rgba(0,0,0,0.22)); display: grid; place-items: center; transition: border-color .16s; }
        .fe-radio-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--agent-coral-deep); transform: scale(0); opacity: 0; transition: transform .22s cubic-bezier(.16,1,.3,1), opacity .16s; }
        .fe-card.on .fe-radio { border-color: #fff; } .fe-card.on .fe-radio-dot { background: #fff; transform: scale(1); opacity: 1; }

        /* Unset state — no fee chosen yet */
        .fe-unset { border-radius: 15px; padding: 18px 20px; margin-bottom: 18px; border: 1px dashed rgba(var(--agent-coral-rgb),0.32); background: rgba(var(--agent-coral-rgb),0.04); }
        .fe-unset-h { margin: 0 0 4px; font-size: 14px; font-weight: 800; letter-spacing: -0.01em; color: var(--agent-coral-ink, #BE3C1C); }
        .fe-unset-sub { margin: 0; font-size: 12.5px; color: var(--agent-text-secondary); line-height: 1.55; max-width: 62ch; }

        /* Hero band */
        .fe-hero { position: relative; border-radius: 15px; padding: 18px 20px; margin-bottom: 18px;
          background: linear-gradient(180deg, rgba(var(--agent-coral-rgb),0.07), rgba(var(--agent-coral-rgb),0.025)); border: 1px solid rgba(var(--agent-coral-rgb),0.16);
          animation: fe-swap .34s cubic-bezier(.22,1,.36,1) both; }
        @keyframes fe-swap { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
        .fe-hero-flat { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
        .fe-hero-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 760px) { .fe-hero-grid { grid-template-columns: 1fr; } }

        .fe-rl { min-width: 0; }
        .fe-rate-k { margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--agent-coral-ink, #BE3C1C); }
        .fe-rate-main { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
        .fe-rate-v { font-size: clamp(40px, 6vw, 60px); font-weight: 860; letter-spacing: -0.04em; line-height: 0.9; color: var(--agent-coral-deep, #E2452A); font-variant-numeric: tabular-nums; }
        .fe-rate-unit { font-size: clamp(16px, 2.2vw, 21px); font-weight: 800; letter-spacing: -0.015em; color: var(--agent-text-primary); }
        .fe-applied { display: flex; align-items: center; gap: 7px; margin-top: 10px; font-size: 13px; color: var(--agent-text-secondary); }
        .fe-applied svg { color: var(--agent-success, #2F7D53); flex-shrink: 0; }

        .fe-edit { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; color: var(--agent-coral-deep, #E2452A);
          background: var(--agent-panel, #fff); border: 1px solid var(--agent-border-subtle); border-radius: 10px; padding: 9px 16px; cursor: pointer; flex-shrink: 0;
          box-shadow: 0 2px 7px -4px rgba(40,26,20,0.25); transition: transform .12s, box-shadow .16s, border-color .16s; }
        :root[data-theme="dark"] .fe-edit { background: rgba(255,255,255,0.06); }
        .fe-edit:hover { transform: translateY(-1px); box-shadow: 0 7px 16px -7px rgba(40,26,20,0.3); border-color: rgba(var(--agent-coral-rgb),0.4); }
        .fe-edit:active { transform: scale(.98); }
        .fe-edit.mt { margin-top: 14px; }
        .fe-edit.sm { padding: 7px 12px; font-size: 12.5px; }

        .fe-money { display: inline-flex; align-items: center; border: 1px solid var(--agent-border-subtle); border-radius: 10px; background: var(--agent-panel, rgba(255,255,255,0.85)); overflow: hidden; transition: border-color .15s; }
        :root[data-theme="dark"] .fe-money { background: rgba(255,255,255,0.05); }
        .fe-money:hover { border-color: var(--agent-border-default, rgba(0,0,0,0.2)); }
        .fe-money:focus-within { border-color: var(--agent-border-strong, rgba(0,0,0,0.42)); }
        :root[data-theme="dark"] .fe-money:focus-within { border-color: rgba(255,255,255,0.55); }
        .fe-money .sym { padding: 0 2px 0 12px; font-size: 14px; color: var(--agent-text-muted); font-weight: 600; }
        .fe-money .sym.pct { padding: 0 12px 0 2px; order: 2; }
        .fe-money input { border: none; outline: none; background: none; font: inherit; font-size: 15px; font-weight: 700; color: var(--agent-text-primary); width: 100%; padding: 10px 12px 10px 4px; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
        .fe-money input::-webkit-outer-spin-button, .fe-money input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .fe-flat { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .fe-unit { font-size: 14px; color: var(--agent-text-secondary); }
        .fe-arrow { color: var(--agent-text-muted); font-weight: 700; }

        /* Tiered — editable bands + read-only rows */
        .fe-bands { display: flex; flex-direction: column; gap: 10px; }
        .fe-band { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .fe-band-th { font-size: 13.5px; color: var(--agent-text-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 7px; min-width: 128px; }
        .fe-rm { appearance: none; border: none; background: none; cursor: pointer; color: var(--agent-text-muted); font-size: 18px; line-height: 1; padding: 2px 5px; border-radius: 6px; transition: color .14s, background .14s; }
        .fe-rm:hover { color: var(--agent-coral-deep); background: rgba(var(--agent-coral-rgb),0.1); }
        .fe-addband { appearance: none; border: none; background: none; cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--agent-coral-ink, #BE3C1C); padding: 4px 0; text-align: left; align-self: flex-start; }
        .fe-addband:hover { text-decoration: underline; }
        .fe-bandrows { display: flex; flex-direction: column; gap: 2px; }
        .fe-bandrow { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid rgba(var(--agent-coral-rgb),0.12); font-size: 14px; }
        .fe-bandrow:first-child { border-top: 0; }
        .fe-bandrow .th { color: var(--agent-text-secondary); font-weight: 600; min-width: 128px; }
        .fe-bandrow .amt { font-weight: 800; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }

        /* Fee calculator */
        .fe-calc { background: linear-gradient(140deg, rgba(var(--agent-coral-rgb),0.09), rgba(var(--agent-coral-rgb),0.02)); border: 1px solid rgba(var(--agent-coral-rgb),0.2); border-radius: 13px; padding: 15px 16px; }
        .fe-calc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .fe-calc-k { margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-coral-ink, #BE3C1C); }
        .fe-calc-sub { margin: 3px 0 0; font-size: 11.5px; color: var(--agent-text-muted); }
        .fe-calc-in { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
        .fe-calc-lbl { font-size: 12px; font-weight: 600; color: var(--agent-text-secondary); }
        .fe-calc-out { display: flex; align-items: baseline; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
        .fe-calc-arrow { color: var(--agent-text-muted); font-size: 16px; align-self: center; }
        .fe-calc-fee { font-size: 30px; font-weight: 860; letter-spacing: -0.03em; color: var(--agent-coral-deep, #E2452A); font-variant-numeric: tabular-nums; line-height: 1; }
        .fe-calc-cap { font-size: 11.5px; color: var(--agent-text-muted); }

        .fe-foot { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .fe-stat { display: flex; align-items: flex-start; gap: 11px; }
        .fe-stat .ic { color: var(--agent-coral-deep, #E2452A); flex-shrink: 0; margin-top: 2px; }
        .fe-stat .v { font-size: 22px; font-weight: 840; letter-spacing: -0.02em; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; line-height: 1; }
        .fe-stat .l { font-size: 11.5px; font-weight: 650; color: var(--agent-text-primary); margin-top: 6px; }
        .fe-stat .d { font-size: 10.5px; color: var(--agent-text-muted); margin-top: 2px; }
        @media (max-width: 720px) { .fe-foot { grid-template-columns: repeat(2, 1fr); gap: 16px; } }

        @media (prefers-reduced-motion: reduce) {
          .fe, .fe-hero { animation: none; }
          .fe-card, .fe-orb, .fe-radio-dot, .fe-money, .fe-edit { transition: none; }
          .fe-spin { animation: none; }
        }
      `}</style>
    </div>
  );
}
