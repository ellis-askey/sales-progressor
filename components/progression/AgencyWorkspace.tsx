"use client";

// One client agency's workspace (opened from a Clients row). Tabs: Overview,
// Branding (logo + brand colour that saves and flows to the agency's portal +
// emails, with a live preview), Sales (their files), People (their logins),
// Access (status + resend the set-up invite). Owner-scoped data comes in via
// props; the colour + resend actions re-check ownership server-side.
// SectionReveal entrance, tab-panel fade, hover states, polished primary button.

import Link from "next/link";
import { useState } from "react";
import { CaretLeft, Plus, Clock, CaretRight, UserPlus, ArrowClockwise } from "@phosphor-icons/react";
import { SectionReveal } from "@/components/hub/SectionReveal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { resendClientInviteAction, setClientBrandColorAction } from "@/app/actions/progression-clients";
import { ClientOverview } from "./ClientOverview";
import type { ClientAgencyDetail } from "@/lib/services/progression-clients";

const TABS = ["Overview", "Branding", "Sales", "People", "Access"] as const;
type Tab = (typeof TABS)[number];
const SWATCHES = ["#1E2A44", "#2F7D53", "#8A5A2B", "#3B6FD4", "#9B2D4F", "#E2452A"];

function salePill(status: string): { label: string; cls: string } {
  if (status === "completed") return { label: "Completed", cls: "done" };
  if (status === "withdrawn") return { label: "Withdrawn", cls: "muted" };
  if (status === "draft") return { label: "Draft", cls: "muted" };
  return { label: "Active", cls: "live" };
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function AgencyWorkspace({ detail }: { detail: ClientAgencyDetail }) {
  const { toast } = useAgentToast();
  const [tab, setTab] = useState<Tab>("Overview");
  const [color, setColor] = useState(detail.brandColor);
  const [resending, setResending] = useState(false);

  async function pickColor(c: string) {
    if (c === color) return;
    const prev = color;
    setColor(c);
    const res = await setClientBrandColorAction(detail.agencyId, c);
    if (!res.ok) { setColor(prev); toast.error(res.error); }
    else toast.success("Brand colour saved", { description: `${detail.name}'s portal and emails now use this colour.` });
  }
  async function resend() {
    setResending(true);
    const res = await resendClientInviteAction(detail.agencyId);
    setResending(false);
    if (res.ok) toast.success("Invite re-sent", { description: detail.email ? `We've emailed ${detail.email}.` : undefined });
    else toast.error(res.error);
  }

  const logo = detail.logoUrl
    ? (<span className="aw-logo"><img src={detail.logoUrl} alt="" /></span>)
    : (<span className="aw-logo aw-logo-mono" style={{ background: color }}>{initials(detail.name)}</span>);

  return (
    <div className="aw">
      <SectionReveal order={0}>
        <Link href="/agent/clients" className="aw-back"><CaretLeft size={15} weight="bold" /> Clients</Link>

        <div className="aw-head">
          <div className="aw-who">
            {logo}
            <div>
              <h1 className="aw-name">{detail.name}</h1>
              <div className="aw-csub">
                <span>{detail.contact ?? "Agent"}</span>
                {detail.email && <span className="aw-dot">·</span>}
                {detail.email && <span>{detail.email}</span>}
                <span className="aw-dot">·</span>
                {detail.status === "active"
                  ? <span className="aw-stat live"><span className="d" />Active</span>
                  : <span className="aw-stat invite"><Clock size={11} weight="bold" />Invite sent</span>}
              </div>
            </div>
          </div>
          <Link href={`/agent/transactions/new?clientAgencyId=${detail.agencyId}`} className="agent-btn agent-btn-primary agent-btn-md aw-primary">
            <Plus size={16} weight="bold" /> Add a sale
          </Link>
        </div>
      </SectionReveal>

      <SectionReveal order={1}>
        <div className="aw-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={t === tab} className={`aw-tab ${t === tab ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="aw-panel" key={tab}>
          {tab === "Overview" && (
            <ClientOverview detail={detail} onTab={setTab} onResend={resend} />
          )}

          {tab === "Branding" && (
            <div className="aw-cards">
              <div className="aw-card">
                <h4>Logo</h4>
                <div className="aw-logobox">
                  {detail.logoUrl
                    ? <span className="aw-logo" style={{ width: 54, height: 54 }}><img src={detail.logoUrl} alt="" /></span>
                    : <span className="aw-logo aw-logo-mono" style={{ width: 54, height: 54, background: color }}>{initials(detail.name)}</span>}
                  <div className="tx">
                    <b>{detail.logoUrl ? "Logo set" : "No logo yet"}</b>
                    <span>{detail.logoUrl ? "Shown on their portal and emails." : "A logo will appear here once it's added."}</span>
                  </div>
                </div>
                <div className="aw-swlabel">Brand colour</div>
                <div className="aw-swatches">
                  {SWATCHES.map((c) => (
                    <button key={c} className={`aw-sw ${c.toLowerCase() === color.toLowerCase() ? "on" : ""}`} style={{ background: c }} onClick={() => pickColor(c)} aria-label={`Set brand colour ${c}`} />
                  ))}
                </div>
              </div>
              <div className="aw-card">
                <h4>Portal preview</h4>
                <div className="aw-portal">
                  <div className="top" style={{ background: color }}><span className="lg" />{detail.name}</div>
                  <div className="bd"><div className="bar" /><div className="bar s" /><span className="chip" style={{ background: color }}>On track</span></div>
                </div>
                <p className="aw-note">How buyers &amp; sellers see their sales — branded with the colour you pick.</p>
              </div>
            </div>
          )}

          {tab === "Sales" && (
            <div className="aw-card full">
              <h4>Their sales · {detail.active} active</h4>
              {detail.sales.length === 0
                ? <p className="aw-empty">No sales yet. Add their first with “Add a sale”.</p>
                : detail.sales.map((s) => {
                    const p = salePill(s.status);
                    return (
                      <Link key={s.id} href={`/agent/transactions/${s.id}`} className="aw-salerow">
                        <span className="ad">{s.address}</span>
                        <span className={`aw-spill ${p.cls}`}>{p.label}</span>
                        <CaretRight size={15} weight="bold" className="aw-salechev" />
                      </Link>
                    );
                  })}
            </div>
          )}

          {tab === "People" && (
            <div className="aw-card full">
              <h4>People · {detail.people.length}</h4>
              {detail.people.map((m) => (
                <div key={m.id} className="aw-mem">
                  <span className="aw-av">{initials(m.name)}</span>
                  <div><div className="nm">{m.name}</div><div className="ro">{m.role === "director" ? "Director" : m.role === "negotiator" ? "Negotiator" : m.role}</div></div>
                  <span className={`aw-tag ${m.pending ? "pend" : "ok"}`}>{m.pending ? "Invite sent" : "Signed in"}</span>
                </div>
              ))}
              <p className="aw-note" style={{ marginTop: 12 }}>Colleagues are added from the agency's own account.</p>
            </div>
          )}

          {tab === "Access" && (
            <div className="aw-cards">
              <div className="aw-card">
                <h4>Login &amp; access</h4>
                <p className="aw-accesstxt">
                  {detail.status === "active"
                    ? `${detail.contact ?? "The agent"} has set up their login. They see only the sales you progress for them.`
                    : `Invite sent to ${detail.email ?? "the agent"} — waiting for them to set a password.`}
                </p>
                <div className="aw-access-actions">
                  <button className="agent-btn agent-btn-secondary agent-btn-sm" onClick={resend} disabled={resending}>
                    <ArrowClockwise size={14} weight="bold" /> {resending ? "Sending…" : "Resend set-up link"}
                  </button>
                </div>
              </div>
              <div className="aw-card">
                <h4>What they can do</h4>
                <ul className="aw-list">
                  <li>See the sales you progress for them, live.</li>
                  <li>Follow each one's progress and documents.</li>
                  <li>Never see another agency's sales, or your other clients.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </SectionReveal>

      <style>{`
        .aw { width: 100%; }
        .aw-back { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--agent-text-muted); font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; margin-bottom: 14px; transition: color .15s, transform .15s; }
        .aw-back:hover { color: var(--agent-coral-deep, #E2452A); transform: translateX(-2px); }

        .aw-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .aw-who { display: flex; align-items: center; gap: 16px; min-width: 0; }
        .aw-logo { width: 60px; height: 60px; border-radius: 16px; overflow: hidden; flex-shrink: 0; border: 0.5px solid var(--agent-border-subtle); display: grid; place-items: center; }
        .aw-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .aw-logo-mono { color: #fff; font-weight: 800; font-size: 20px; }
        .aw-name { margin: 0 0 3px; font-size: clamp(22px, 3.4vw, 28px); font-weight: 820; letter-spacing: -0.02em; color: var(--agent-text-primary); }
        .aw-csub { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 13px; color: var(--agent-text-muted); }
        .aw-dot { opacity: 0.5; }
        .aw-stat { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; }
        .aw-stat.live { color: var(--agent-success, #2F7D53); } .aw-stat.live .d { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .aw-stat.invite { color: #B5831E; } :root[data-theme="dark"] .aw-stat.invite { color: #E0B050; }

        .aw-primary { gap: 8px; background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); text-decoration: none; }
        .aw-primary:hover { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .aw-primary:active { transform: scale(0.98); }

        .aw-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 15px 18px; border-radius: 14px; border: 1px solid rgba(var(--agent-coral-rgb),0.25); background: rgba(var(--agent-coral-rgb),0.08); margin-bottom: 18px; }
        .aw-banner .tt { font-size: 13.5px; font-weight: 750; color: var(--agent-text-primary); }
        .aw-banner .ds { font-size: 12px; color: var(--agent-text-secondary); margin-top: 2px; }
        .aw-banner-right { min-width: 210px; flex: 1; max-width: 290px; }
        .aw-meter { height: 8px; border-radius: 999px; background: rgba(var(--agent-coral-rgb),0.18); overflow: hidden; margin-bottom: 6px; }
        .aw-meter i { display: block; height: 100%; background: linear-gradient(90deg, var(--agent-coral), var(--agent-coral-deep)); border-radius: 999px; transition: width .9s cubic-bezier(.22,1,.36,1); }
        .aw-legend { font-size: 10.5px; color: var(--agent-text-muted); }

        .aw-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--agent-border-subtle); margin-bottom: 18px; overflow-x: auto; }
        .aw-tab { appearance: none; background: none; border: none; cursor: pointer; font-size: 13.5px; font-weight: 650; color: var(--agent-text-muted); padding: 10px 14px; position: relative; white-space: nowrap; transition: color .15s; }
        .aw-tab:hover { color: var(--agent-text-primary); }
        .aw-tab.on { color: var(--agent-coral-deep, #E2452A); }
        .aw-tab.on::after { content: ""; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px; background: var(--agent-coral-deep, #E2452A); border-radius: 2px; }
        .aw-panel { animation: aw-panelin .32s cubic-bezier(.22,1,.36,1) both; }
        @keyframes aw-panelin { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .aw-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 760px) { .aw-cards { grid-template-columns: 1fr; } }
        .aw-card { background: var(--agent-glass-bg, rgba(255,255,255,0.5)); border: 1px solid var(--agent-border-subtle); border-radius: 15px; padding: 17px; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
        .aw-card.full { grid-column: 1 / -1; }
        .aw-card h4 { margin: 0 0 13px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); }
        .aw-empty { font-size: 13px; color: var(--agent-text-muted); margin: 0; }

        .aw-ov { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .aw-ov-stat { text-align: center; }
        .aw-ov-stat .v { font-size: 26px; font-weight: 820; letter-spacing: -0.02em; color: var(--agent-text-primary); }
        .aw-ov-stat .k { font-size: 10.5px; color: var(--agent-text-muted); margin-top: 3px; }

        .aw-salerow { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--agent-border-subtle); text-decoration: none; transition: padding .15s; }
        .aw-salerow:first-of-type { border-top: 0; }
        .aw-salerow:hover { padding-left: 4px; }
        .aw-salerow .ad { font-size: 13px; font-weight: 600; color: var(--agent-text-primary); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .aw-salechev { color: var(--agent-text-muted); flex-shrink: 0; }
        .aw-spill { font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
        .aw-spill.live { background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); }
        .aw-spill.done { background: rgba(47,125,83,0.14); color: var(--agent-success, #2F7D53); }
        .aw-spill.muted { background: var(--agent-glass-bg, rgba(0,0,0,0.05)); color: var(--agent-text-muted); }
        .aw-link { appearance: none; background: none; border: none; cursor: pointer; font-size: 12.5px; color: var(--agent-coral-ink, #BE3C1C); font-weight: 700; margin-top: 10px; padding: 0; }
        .aw-link:hover { text-decoration: underline; }

        .aw-logobox { display: flex; align-items: center; gap: 14px; border: 1px solid var(--agent-border-subtle); border-radius: 12px; padding: 14px; background: var(--agent-glass-bg, rgba(255,255,255,0.4)); }
        .aw-logobox .tx b { display: block; font-size: 12.5px; font-weight: 650; color: var(--agent-text-primary); margin-bottom: 2px; }
        .aw-logobox .tx span { font-size: 11px; color: var(--agent-text-muted); }
        .aw-swlabel { font-size: 10.5px; font-weight: 600; color: var(--agent-text-muted); margin: 16px 0 9px; text-transform: uppercase; letter-spacing: 0.06em; }
        .aw-swatches { display: flex; gap: 9px; }
        .aw-sw { width: 30px; height: 30px; border-radius: 9px; cursor: pointer; border: 2px solid transparent; transition: transform .14s; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
        .aw-sw:hover { transform: scale(1.1); }
        .aw-sw.on { border-color: var(--agent-text-primary); }

        .aw-portal { border-radius: 12px; overflow: hidden; border: 1px solid var(--agent-border-subtle); }
        .aw-portal .top { height: 50px; display: flex; align-items: center; gap: 10px; padding: 0 14px; color: #fff; font-size: 13px; font-weight: 700; transition: background .3s; }
        .aw-portal .top .lg { width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,0.92); flex-shrink: 0; }
        .aw-portal .bd { padding: 14px; background: var(--agent-glass-bg, rgba(0,0,0,0.03)); }
        .aw-portal .bar { height: 9px; border-radius: 999px; background: var(--agent-border-subtle); margin-bottom: 8px; }
        .aw-portal .bar.s { width: 58%; }
        .aw-portal .chip { display: inline-block; height: 22px; line-height: 22px; padding: 0 12px; border-radius: 999px; font-size: 10px; font-weight: 700; color: #fff; transition: background .3s; }
        .aw-note { font-size: 11px; color: var(--agent-text-muted); margin: 10px 0 0; }

        .aw-mem { display: flex; align-items: center; gap: 11px; padding: 10px 0; border-top: 1px solid var(--agent-border-subtle); }
        .aw-mem:first-of-type { border-top: 0; }
        .aw-av { width: 34px; height: 34px; border-radius: 50%; background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); display: grid; place-items: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
        .aw-mem .nm { font-size: 13px; font-weight: 650; color: var(--agent-text-primary); }
        .aw-mem .ro { font-size: 11px; color: var(--agent-text-muted); }
        .aw-tag { margin-left: auto; font-size: 10px; font-weight: 700; }
        .aw-tag.ok { color: var(--agent-success, #2F7D53); } .aw-tag.pend { color: #B5831E; } :root[data-theme="dark"] .aw-tag.pend { color: #E0B050; }

        .aw-accesstxt { font-size: 12.5px; color: var(--agent-text-secondary); line-height: 1.6; margin: 0; }
        .aw-access-actions { margin-top: 14px; display: flex; gap: 9px; flex-wrap: wrap; }
        .aw-list { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--agent-text-secondary); line-height: 1.8; }

        @media (prefers-reduced-motion: reduce) { .aw-panel { animation: none; } .aw-meter i { transition: none; } }
      `}</style>
    </div>
  );
}
