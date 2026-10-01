"use client";

// The populated Clients landing for a progression-business owner: a growth
// header, a rich clickable row per client agency (logo, people, active /
// pipeline / exchanged, status), a "grow your book" prompt, and the add-client
// modal. Full-width; SectionReveal entrance + hover-lift rows + the canonical
// polished primary button. Rows link to the agency workspace at
// /agent/clients/[agencyId].

import Link from "next/link";
import { useState } from "react";
import { UserPlus, CaretRight, Clock, Buildings, TrendUp, CurrencyGbp, Handshake } from "@phosphor-icons/react";
import { SectionReveal } from "@/components/hub/SectionReveal";
import { GlassCard } from "@/components/glass/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { fmtCurrencyPence } from "@/lib/utils";
import type { ClientsOverview, ClientOverviewRow } from "@/lib/services/progression-clients";
import { useAddClientForm } from "./useAddClientForm";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// Compact money for the totals bar (matches CompletionsMomentum): £1.2M / £45k / £0.
function fmtCompact(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (pounds >= 1_000) return "£" + Math.round(pounds / 1_000) + "k";
  return "£" + pounds.toLocaleString("en-GB");
}

function Logo({ c }: { c: ClientOverviewRow }) {
  if (c.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <span className="cw-logo"><img src={c.logoUrl} alt="" /></span>;
  }
  return <span className="cw-logo cw-logo-mono">{initials(c.name)}</span>;
}

export function ClientsWorkspace({ data }: { data: ClientsOverview }) {
  const [addOpen, setAddOpen] = useState(false);
  const { totals, clients } = data;

  const cells = [
    { tone: "coral", icon: <Buildings size={22} weight="fill" />, value: String(totals.agencies), label: "Agencies", sub: "In your book" },
    { tone: "info", icon: <TrendUp size={22} weight="bold" />, value: String(totals.activeSales), label: "Active sales", sub: "Across all clients" },
    { tone: "warning", icon: <CurrencyGbp size={22} weight="fill" />, value: fmtCompact(totals.pipelinePence), label: "Pipeline value", sub: "In progress" },
    { tone: "success", icon: <Handshake size={22} weight="fill" />, value: String(totals.exchangedThisMonth), label: "Exchanged this month", sub: "Completed deals" },
  ];

  return (
    <div className="cw">
      <SectionReveal order={0}>
        <div className="cw-top">
          <div>
            <h1 className="cw-h1">Clients</h1>
            <p className="cw-sub">Run and grow your book of agencies.</p>
          </div>
          <Button variant="primary" size="md" className="cw-primary" onClick={() => setAddOpen(true)}>
            <UserPlus size={16} weight="bold" />
            Add a client
          </Button>
        </div>
      </SectionReveal>

      <SectionReveal order={1}>
        <GlassCard glassId="clients-totals" label="Clients totals" defaultVariant="v05" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div className="cw-bar">
            {cells.map((c, i) => (
              <div key={c.label} className="cw-cell" style={{ borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)" : undefined }}>
                <span aria-hidden className={`stat-circle stat-circle--${c.tone}`}>{c.icon}</span>
                <span className="cw-cell-tx">
                  <span className="cw-cell-v">{c.value}</span>
                  <span className="cw-cell-l">{c.label}</span>
                  <span className="cw-cell-s">{c.sub}</span>
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </SectionReveal>

      <SectionReveal order={2}>
        <p className="cw-label">Your agencies</p>
        <div className="cw-rows">
          {clients.map((c) => (
            <Link key={c.linkId} href={`/agent/clients/${c.agencyId}`} className="cw-row">
              <Logo c={c} />
              <div className="cw-main">
                <div className="cw-name">{c.name}</div>
                <div className="cw-meta">
                  {c.contact ?? "Agent"}
                  {c.status === "invite" ? " · invite sent" : ` · ${c.people} ${c.people === 1 ? "person" : "people"}`}
                </div>
              </div>
              <div className="cw-mstats">
                <div className="ms"><div className="n">{c.active}</div><div className="l">active</div></div>
                <div className="ms"><div className="n">{fmtCurrencyPence(c.pipelinePence)}</div><div className="l">pipeline</div></div>
                <div className="ms"><div className="n">{c.exchanged}</div><div className="l">exchanged</div></div>
              </div>
              {c.status === "active"
                ? <span className="cw-pill active"><span className="dot" />Active</span>
                : <span className="cw-pill invite"><Clock size={11} weight="bold" />Invite sent</span>}
              <CaretRight size={19} weight="bold" className="cw-chev" />
            </Link>
          ))}
        </div>
      </SectionReveal>

      {addOpen && <AddClientModal onClose={() => setAddOpen(false)} />}

      <style>{`
        .cw { width: 100%; display: flex; flex-direction: column; gap: 22px; }
        .cw-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .cw-h1 { margin: 0 0 3px; font-size: clamp(26px, 4vw, 34px); font-weight: 820; letter-spacing: -0.03em; color: var(--agent-text-primary); }
        .cw-sub { margin: 0; font-size: 14px; color: var(--agent-text-secondary); }

        /* polished primary gradient (matches .enq-btn-primary2 / .rem-chase-go) */
        .cw-primary { gap: 8px;
          background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .cw-primary:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .cw-primary:active:not(:disabled) { transform: scale(0.98); }

        .cw-bar { display: grid; grid-template-columns: repeat(4, 1fr); }
        .cw-cell { display: flex; align-items: center; gap: 12px; padding: 15px 17px; }
        .cw-cell-tx { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .cw-cell-v { font-size: 22px; font-weight: 600; line-height: 1; letter-spacing: -0.01em; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }
        .cw-cell-l { font-size: 12.5px; font-weight: 600; color: var(--agent-text-primary); line-height: 1.2; }
        .cw-cell-s { font-size: 10.5px; color: var(--agent-text-muted); line-height: 1.2; }
        @media (max-width: 680px) {
          .cw-bar { grid-template-columns: repeat(2, 1fr); }
          .cw-cell:nth-child(odd) { border-left: none !important; }
          .cw-cell:nth-child(3), .cw-cell:nth-child(4) { border-top: 1px solid var(--agent-border-subtle); }
        }

        .cw-label { margin: 2px 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--agent-text-muted); }
        .cw-rows { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .cw-row {
          display: flex; align-items: center; gap: 15px; padding: 14px 16px; border-radius: 16px;
          border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5));
          -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); text-decoration: none;
          transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s, border-color .2s;
        }
        .cw-row:hover { transform: translateY(-3px); border-color: var(--agent-border-default, rgba(0,0,0,0.12)); box-shadow: 0 18px 38px -20px rgba(40,26,20,0.4); }
        :root[data-theme="dark"] .cw-row:hover { box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6); }
        .cw-row:active { transform: translateY(-1px) scale(.996); }
        .cw-logo { width: 52px; height: 52px; border-radius: 14px; overflow: hidden; flex-shrink: 0; border: 0.5px solid var(--agent-border-subtle); display: grid; place-items: center; }
        .cw-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cw-logo-mono { background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
        .cw-main { min-width: 0; flex: 1; }
        .cw-name { font-size: 16px; font-weight: 760; letter-spacing: -0.01em; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cw-meta { font-size: 12.5px; color: var(--agent-text-muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cw-mstats { display: flex; gap: 26px; flex-shrink: 0; }
        .cw-mstats .ms { text-align: right; }
        .cw-mstats .n { font-size: 16.5px; font-weight: 800; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; line-height: 1; }
        .cw-mstats .l { font-size: 10px; color: var(--agent-text-faint, var(--agent-text-muted)); margin-top: 4px; }
        .cw-pill { font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; padding: 4px 10px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }
        .cw-pill.active { color: var(--agent-success, #2F7D53); background: rgba(47,125,83,0.13); }
        .cw-pill.invite { color: #B5831E; background: rgba(214,158,46,0.16); }
        :root[data-theme="dark"] .cw-pill.invite { color: #E0B050; }
        .cw-pill .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
        .cw-chev { color: var(--agent-text-muted); flex-shrink: 0; transition: transform .2s, color .2s; }
        .cw-row:hover .cw-chev { transform: translateX(3px); color: var(--agent-coral-deep, #E2452A); }
        @media (max-width: 760px) { .cw-mstats { display: none; } }
      `}</style>
    </div>
  );
}

// ── Add-client modal ─────────────────────────────────────────────────────────

function AddClientModal({ onClose }: { onClose: () => void }) {
  const f = useAddClientForm(onClose);

  return (
    <Modal open onClose={onClose} ariaLabel="Add a client" size="lg" closeTone="onDark">
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader icon={<UserPlus size={18} weight="bold" />} title="Add a client" subtitle="Bring an estate agent into your book." />
      </Modal.Header>

      <Modal.Body>
        <div className="cwm-field">
          <label className="cwm-label" htmlFor="cwm-name">Contact name</label>
          <input id="cwm-name" className="agent-input" value={f.agentName} onChange={(e) => f.setAgentName(e.target.value)} onBlur={f.blurName} placeholder="e.g. Sophie Bennett" maxLength={100} />
        </div>
        <div className="cwm-row">
          <div className="cwm-field">
            <label className="cwm-label" htmlFor="cwm-email">Email address</label>
            <input id="cwm-email" className="agent-input" type="email" value={f.agentEmail} onChange={(e) => f.setAgentEmail(e.target.value)} onBlur={f.blurEmail} placeholder="sophie@oakandkey.co.uk" maxLength={255} aria-invalid={f.emailInvalid || undefined} />
          </div>
          <div className="cwm-field">
            <label className="cwm-label" htmlFor="cwm-agency">Agency name</label>
            <input id="cwm-agency" className="agent-input" value={f.agencyName} onChange={(e) => f.setAgencyName(e.target.value)} onBlur={f.blurAgency} placeholder="e.g. Oak & Key" maxLength={120} />
          </div>
        </div>

        {f.emailInvalid && <p className="cwm-err">Enter a valid email address.</p>}
        {f.error && <p className="cwm-err">{f.error}</p>}
        <p className="cwm-help">We&rsquo;ll email them an invite to set up their login. They&rsquo;ll only have access to their own sales.</p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" className="cwm-primary" onClick={f.submit} disabled={!f.canSubmit} loading={f.adding}>
          <UserPlus size={16} weight="bold" />
          Add client
        </Button>
      </Modal.Footer>

      <style>{`
        .cwm-field { margin-bottom: 12px; }
        .cwm-field:last-child { margin-bottom: 0; }
        .cwm-label { display: block; font-size: 12px; font-weight: 600; color: var(--agent-text-secondary); margin-bottom: 6px; }
        .cwm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 460px) { .cwm-row { grid-template-columns: 1fr; } }
        .cwm-err { margin: 12px 0 0; font-size: 12.5px; color: #C7401F; }
        .cwm-help { margin: 14px 0 0; font-size: 12px; color: var(--agent-text-muted); line-height: 1.5; }
        .cwm-primary { gap: 8px; background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .cwm-primary:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .cwm-primary:active:not(:disabled) { transform: scale(0.98); }
      `}</style>
    </Modal>
  );
}
