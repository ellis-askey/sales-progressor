"use client";

// The Overview tab of a client agency's workspace. A considered dashboard, not a
// dump: performance (real metrics from their files), their service + portal
// settings (real Agency flags, toggled live), recent sales, and the setup
// checklist. App patterns throughout — agent-eyebrow headers (no icon backers),
// agent-glass surfaces, a staggered fade-up reveal, reduced-motion safe.
//
// The fee engine (how the progressor charges this client) is the next layer — it
// needs a per-client rate-card model and lands in its own build.

import Link from "next/link";
import { useState } from "react";
import { CaretRight, Check, Circle } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { fmtCurrencyPence } from "@/lib/utils";
import { setClientAgencyFlagAction } from "@/app/actions/progression-clients";
import { FeeEngine } from "./FeeEngine";
import type { ClientAgencyDetail, ClientAgencyFlags } from "@/lib/services/progression-clients";

type Tab = "Overview" | "Branding" | "Sales" | "People" | "Access";

function salePill(status: string): { label: string; cls: string } {
  if (status === "completed") return { label: "Completed", cls: "done" };
  if (status === "withdrawn") return { label: "Withdrawn", cls: "muted" };
  if (status === "draft") return { label: "Draft", cls: "muted" };
  return { label: "Active", cls: "live" };
}
const pct = (n: number | null) => (n == null ? "N/A" : `${n}%`);
const num = (n: number | null) => (n == null ? "N/A" : String(n));

export function ClientOverview({
  detail,
  onTab,
  onResend,
}: {
  detail: ClientAgencyDetail;
  onTab: (t: Tab) => void;
  onResend: () => void;
}) {
  const { toast } = useAgentToast();
  const [flags, setFlags] = useState<ClientAgencyFlags>(detail.flags);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(key: keyof ClientAgencyFlags, label: string) {
    if (saving) return;
    const next = !flags[key];
    setFlags((f) => ({ ...f, [key]: next }));
    setSaving(key);
    const res = await setClientAgencyFlagAction(detail.agencyId, key, next);
    setSaving(null);
    if (!res.ok) {
      setFlags((f) => ({ ...f, [key]: !next }));
      toast.error(res.error);
    } else {
      toast.success(next ? `${label} on` : `${label} off`);
    }
  }

  const sw = (key: keyof ClientAgencyFlags, label: string) => (
    <div className="ov-toggle">
      <span className="k">{label}</span>
      <button type="button" className={`ov-sw ${flags[key] ? "on" : "off"}`} onClick={() => toggle(key, label)} aria-pressed={flags[key]} aria-label={label}><i /></button>
    </div>
  );

  const checkGo = (label: string): { text: string; href?: string; go?: () => void } | null => {
    if (label === "Brand colour" || label === "Logo added") return { text: "Branding", go: () => onTab("Branding") };
    if (label === "Agent joined") return { text: "Resend", go: onResend };
    if (label === "First sale") return { text: "Add", href: `/agent/transactions/new?clientAgencyId=${detail.agencyId}` };
    return null;
  };

  return (
    <>
      <FeeEngine agencyId={detail.agencyId} name={detail.name} initial={detail.feeModel} fees={detail.fees} />
      <div className="ov">
      {/* Performance */}
      <div className="ov-card span2" style={{ animationDelay: "0ms" }}>
        <p className="ov-eyebrow">Performance</p>
        <div className="ov-stat3">
          <div className="s"><div className="v">{detail.active}</div><div className="l">active</div></div>
          <div className="s"><div className="v">{detail.exchanged}</div><div className="l">exchanged</div></div>
          <div className="s"><div className="v">{detail.completed}</div><div className="l">completed</div></div>
        </div>
        <div className="ov-kv"><span className="k">Avg days to exchange</span><span className="v">{num(detail.avgDaysToExchange)}</span></div>
        <div className="ov-kv"><span className="k">Agreed → exchanged</span><span className="v good">{pct(detail.conversionPct)}</span></div>
        <div className="ov-kv"><span className="k">Fall-through rate</span><span className="v warn">{pct(detail.fallThroughPct)}</span></div>
      </div>

      {/* Recent sales */}
      <div className="ov-card" style={{ animationDelay: "60ms" }}>
        <p className="ov-eyebrow">Recent sales</p>
        {detail.sales.length === 0
          ? <p className="ov-empty">No sales yet. Add their first sale to get started.</p>
          : (<>
              {detail.sales.slice(0, 5).map((s) => {
                const p = salePill(s.status);
                return (
                  <Link key={s.id} href={`/agent/transactions/${s.id}`} className="ov-salerow">
                    <span className="ad">{s.address}</span>
                    <span className={`ov-spill ${p.cls}`}>{p.label}</span>
                    <CaretRight size={14} weight="bold" className="ov-chev" />
                  </Link>
                );
              })}
              {detail.sales.length > 5 && <button className="ov-link" onClick={() => onTab("Sales")}>View all {detail.sales.length} sales →</button>}
            </>)}
      </div>

      {/* Service & defaults */}
      <div className="ov-card" style={{ animationDelay: "120ms" }}>
        <p className="ov-eyebrow">Service &amp; chasing</p>
        <p className="ov-sub">Choose what we automatically chase on their files.</p>
        {sw("solicitorChase", "Chase solicitors")}
        {sw("enquiryChase", "Chase enquiries")}
        {sw("weeklyUpdate", "Weekly client update")}
      </div>

      {/* Portal defaults */}
      <div className="ov-card" style={{ animationDelay: "160ms" }}>
        <p className="ov-eyebrow">Portal defaults</p>
        <p className="ov-sub">Choose what their buyers and sellers can see.</p>
        {sw("portalKeyDates", "Key dates card")}
        {sw("portalCosts", "Costs estimate")}
        {sw("portalProgress", "Progress percentage")}
      </div>

      {/* Finish setup */}
      <div className="ov-card" style={{ animationDelay: "200ms" }}>
        <p className="ov-eyebrow">Finish setup · {detail.completePct}%</p>
        <div className="ov-meter"><i style={{ width: `${detail.completePct}%` }} /></div>
        {detail.checks.map((c) => {
          const go = c.done ? null : checkGo(c.label);
          return (
            <div className="ov-check" key={c.label}>
              {c.done
                ? <Check size={16} weight="bold" className="ov-tick" />
                : <Circle size={14} weight="regular" className="ov-tick off" />}
              <span className="lbl">{c.label}</span>
              {go && (go.href
                ? <Link href={go.href} className="go">{go.text} <span className="go-arr">→</span></Link>
                : <button className="go" onClick={go.go}>{go.text} <span className="go-arr">→</span></button>)}
            </div>
          );
        })}
      </div>

      <style>{`
        .ov { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .ov .span2 { grid-column: span 2; }
        @media (max-width: 920px) { .ov { grid-template-columns: repeat(2, 1fr); } .ov .span2 { grid-column: 1 / -1; } }
        @media (max-width: 600px) { .ov { grid-template-columns: 1fr; } }

        .ov-card {
          background: var(--agent-glass-bg, rgba(255,255,255,0.5)); border: 1px solid var(--agent-border-subtle);
          border-radius: 15px; padding: 17px; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
          animation: ov-in .46s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes ov-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
        .ov-eyebrow { margin: 0 0 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: var(--agent-text-muted); }
        .ov-sub { margin: -8px 0 12px; font-size: 11px; color: var(--agent-text-muted); }
        .ov-empty { margin: 0; font-size: 13px; color: var(--agent-text-muted); }

        .ov-stat3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
        .ov-stat3 .s { text-align: center; }
        .ov-stat3 .v { font-size: 27px; font-weight: 820; letter-spacing: -0.02em; color: var(--agent-text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
        .ov-stat3 .l { font-size: 10.5px; color: var(--agent-text-muted); margin-top: 5px; }
        .ov-kv { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; padding: 8px 0; border-top: 1px solid var(--agent-border-subtle); }
        .ov-kv .k { color: var(--agent-text-secondary); }
        .ov-kv .v { font-weight: 700; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }
        .ov-kv .v.good { color: var(--agent-success, #2F7D53); }
        .ov-kv .v.warn { color: #B5831E; } :root[data-theme="dark"] .ov-kv .v.warn { color: #E0B050; }

        .ov-salerow { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--agent-border-subtle); text-decoration: none; transition: padding-left .15s; }
        .ov-salerow:first-of-type { border-top: 0; }
        .ov-salerow:hover { padding-left: 3px; }
        .ov-salerow .ad { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ov-chev { color: var(--agent-text-muted); flex-shrink: 0; }
        .ov-spill { font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
        .ov-spill.live { background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); }
        .ov-spill.done { background: rgba(47,125,83,0.14); color: var(--agent-success, #2F7D53); }
        .ov-spill.muted { background: var(--agent-glass-bg, rgba(0,0,0,0.05)); color: var(--agent-text-muted); }
        .ov-link { appearance: none; background: none; border: none; cursor: pointer; font-size: 12px; color: var(--agent-coral-ink, #BE3C1C); font-weight: 700; margin-top: 10px; padding: 0; }
        .ov-link:hover { text-decoration: underline; }

        .ov-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-top: 1px solid var(--agent-border-subtle); }
        .ov-toggle:first-of-type { border-top: 0; }
        .ov-toggle .k { font-size: 12.5px; font-weight: 600; color: var(--agent-text-primary); }
        .ov-sw { width: 36px; height: 21px; border-radius: 999px; position: relative; cursor: pointer; border: none; flex-shrink: 0; transition: background .18s ease; padding: 0; }
        .ov-sw.on { background: var(--agent-coral-deep, #E2452A); }
        .ov-sw.off { background: var(--agent-border-strong, rgba(0,0,0,0.18)); }
        :root[data-theme="dark"] .ov-sw.off { background: rgba(255,255,255,0.2); }
        .ov-sw i { position: absolute; top: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: left .18s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }
        .ov-sw.on i { left: 17px; } .ov-sw.off i { left: 2px; }

        .ov-meter { height: 8px; border-radius: 999px; background: rgba(var(--agent-coral-rgb),0.18); overflow: hidden; margin-bottom: 12px; }
        .ov-meter i { display: block; height: 100%; background: linear-gradient(90deg, var(--agent-coral), var(--agent-coral-deep)); border-radius: 999px; transition: width .9s cubic-bezier(.22,1,.36,1); }
        .ov-check { display: flex; align-items: center; gap: 9px; font-size: 12.5px; padding: 7px 0; }
        .ov-check .ov-tick { flex-shrink: 0; color: var(--agent-success, #2F7D53); }
        .ov-check .ov-tick.off { color: var(--agent-text-faint, var(--agent-text-muted)); }
        .ov-check .lbl { color: var(--agent-text-primary); }
        .ov-check .go { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--agent-coral-ink, #BE3C1C); font-weight: 700; text-decoration: none; background: none; border: none; cursor: pointer; padding: 0; }
        .ov-check .go .go-arr { transition: transform .18s cubic-bezier(.22,1,.36,1); }
        .ov-check .go:hover .go-arr { transform: translateX(3px); }

        @media (prefers-reduced-motion: reduce) { .ov-card { animation: none; } .ov-meter i, .ov-sw, .ov-sw i, .ov-check .go-arr { transition: none; } }
      `}</style>
      </div>
    </>
  );
}
