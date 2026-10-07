"use client";

// The populated Clients landing for a progression-business owner: a growth
// header, a rich clickable row per client agency (logo, people, active /
// pipeline / exchanged, status), a "grow your book" prompt, and the add-client
// modal. Full-width; SectionReveal entrance + hover-lift rows + the canonical
// polished primary button. Rows link to the agency workspace at
// /agent/clients/[agencyId].

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { UserPlus, CaretRight, Clock, Buildings, TrendUp, CurrencyGbp, Handshake, Gear, UsersThree, ArrowCounterClockwise, Plus } from "@phosphor-icons/react";
import { SectionReveal } from "@/components/hub/SectionReveal";
import { GlassCard } from "@/components/glass/GlassCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { fmtCurrencyPence } from "@/lib/utils";
import type { ClientsOverview, ClientOverviewRow } from "@/lib/services/progression-clients";
import { updateBusinessShortNameAction, reinstateClientAgencyAction } from "@/app/actions/progression-clients";
import { AgencyMeshMark } from "./AgencyMeshMark";
import { useAddClientForm } from "./useAddClientForm";

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
    return <span className="cw-logo" style={{ background: c.tileColor ?? "#ffffff" }}><img src={c.logoUrl} alt="" /></span>;
  }
  // No logo: a generated mesh-monogram mark (critique #186), not plain initials.
  return <span className="cw-logo"><AgencyMeshMark name={c.name} size={52} /></span>;
}

// A greyed, non-navigating row for an archived client, with an inline reinstate.
function RemovedRow({ c }: { c: ClientOverviewRow }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [pending, start] = useTransition();
  function reinstate() {
    start(async () => {
      const res = await reinstateClientAgencyAction(c.agencyId);
      if (res.ok) { toast.success(`${c.name} reinstated`); router.refresh(); }
      else toast.error(res.error);
    });
  }
  return (
    <div className="cw-row removed">
      <Logo c={c} />
      <div className="cw-main">
        <div className="cw-name">{c.name}</div>
        <div className="cw-meta">{c.contact ?? "Agent"} · Removed</div>
      </div>
      <button type="button" className="cw-reinstate" onClick={reinstate} disabled={pending}>
        <ArrowCounterClockwise size={14} weight="bold" />
        {pending ? "Reinstating…" : "Reinstate"}
      </button>
    </div>
  );
}

export function ClientsWorkspace({ data }: { data: ClientsOverview }) {
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { business, totals, clients } = data;
  const activeClients = clients.filter((c) => !c.removed);
  const removedClients = clients.filter((c) => c.removed);

  const cells = [
    { tone: "coral", icon: <Buildings size={22} weight="fill" />, value: String(totals.agencies), label: "Agencies", sub: "In your book" },
    { tone: "info", icon: <TrendUp size={22} weight="bold" />, value: String(totals.activeSales), label: "Active sales", sub: "Across all clients" },
    { tone: "warning", icon: <CurrencyGbp size={22} weight="fill" />, value: fmtCompact(totals.pipelinePence), label: "Pipeline value", sub: "In progress" },
    { tone: "success", icon: <Handshake size={22} weight="fill" />, value: String(totals.exchangedThisMonth), label: "Exchanged this month", sub: "Sales exchanged" },
  ];

  return (
    <div className="cw">
      <SectionReveal order={0}>
        <div className="cw-top">
          <div>
            <h1 className="cw-h1">Clients</h1>
            <p className="cw-sub">Manage and grow your book of agencies.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/agent/team"
              title="Your team"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                height: 42, padding: "0 15px", borderRadius: 12,
                border: "1px solid var(--agent-border-default)",
                background: "var(--agent-surface)", color: "var(--agent-text-secondary)",
                fontSize: 13, fontWeight: 650, textDecoration: "none",
                transition: "border-color 160ms ease, color 160ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--agent-coral)"; e.currentTarget.style.color = "var(--agent-coral-deep)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--agent-border-default)"; e.currentTarget.style.color = "var(--agent-text-secondary)"; }}
            >
              <UsersThree size={17} weight="bold" />
              Team
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Business settings"
              aria-label="Business settings"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 42, height: 42, borderRadius: 12,
                border: "1px solid var(--agent-border-default)",
                background: "var(--agent-surface)", color: "var(--agent-text-secondary)",
                cursor: "pointer", transition: "border-color 160ms ease, color 160ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--agent-coral)"; e.currentTarget.style.color = "var(--agent-coral-deep)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--agent-border-default)"; e.currentTarget.style.color = "var(--agent-text-secondary)"; }}
            >
              <Gear size={18} weight="bold" />
            </button>
            <Button variant="primary" size="md" className="cw-primary" onClick={() => setAddOpen(true)}>
              <UserPlus size={16} weight="bold" />
              Add a client
            </Button>
          </div>
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
          {activeClients.map((c) => (
            <div key={c.linkId} className="cw-row">
              <Link href={`/agent/clients/${c.agencyId}`} className="cw-rowmain">
                <Logo c={c} />
                <div className="cw-main">
                  {/* Agency names run long, so they take the full top line; the
                      status sits on the bottom row with the (shorter) agent name,
                      right-aligned, which truncates far less often. */}
                  <div className="cw-name">{c.name}</div>
                  <div className="cw-metarow">
                    <div className="cw-meta">
                      {c.contact ?? "Agent"}
                      {c.status === "active" ? ` · ${c.people} ${c.people === 1 ? "person" : "people"}` : ""}
                    </div>
                    {c.status === "active"
                      ? <span className="cw-status active"><span className="dot" />Active</span>
                      : <span className="cw-status invite"><Clock size={12} weight="bold" />Invite sent</span>}
                  </div>
                </div>
                <div className="cw-mstats">
                  <div className="ms"><div className="n">{c.active}</div><div className="l">active</div></div>
                  <div className="ms"><div className="n">{fmtCurrencyPence(c.pipelinePence)}</div><div className="l">pipeline</div></div>
                  <div className="ms"><div className="n">{c.exchanged}</div><div className="l">exchanged</div></div>
                </div>
              </Link>
              {/* One-click add-sale for this client (the form opens pre-set to them).
                  The fee gate on the form handles a client with no rate set yet. */}
              <Link
                href={`/agent/transactions/new?clientAgencyId=${c.agencyId}`}
                className="cw-rowadd"
                title={`Add a sale for ${c.name}`}
                aria-label={`Add a sale for ${c.name}`}
              >
                <Plus size={16} weight="bold" />
                <span className="cw-rowadd-l">Add sale</span>
              </Link>
              <CaretRight size={19} weight="bold" className="cw-chev" />
            </div>
          ))}
        </div>

        {removedClients.length > 0 && (
          <div className="cw-removed">
            <p className="cw-label">Removed</p>
            <div className="cw-rows">
              {removedClients.map((c) => (
                <RemovedRow key={c.linkId} c={c} />
              ))}
            </div>
          </div>
        )}
      </SectionReveal>

      {addOpen && <AddClientModal onClose={() => setAddOpen(false)} />}
      {settingsOpen && <BusinessSettingsModal business={business} onClose={() => setSettingsOpen(false)} />}

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
          /* overflow:hidden clips the backdrop-filter to the rounded corners — without
             it, iOS Safari renders the frosted-glass blur as a square behind the card. */
          overflow: hidden;
          border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5));
          -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); text-decoration: none;
          transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s, border-color .2s;
        }
        .cw-row:hover { transform: translateY(-3px); border-color: var(--agent-border-default, rgba(0,0,0,0.12)); box-shadow: 0 18px 38px -20px rgba(40,26,20,0.4); }
        :root[data-theme="dark"] .cw-row:hover { box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6); }
        .cw-row:active { transform: translateY(-1px) scale(.996); }
        .cw-rowmain { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0; text-decoration: none; }
        .cw-rowadd {
          display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
          padding: 8px 13px; border-radius: 10px;
          border: 1px solid var(--agent-border-default); background: var(--agent-surface);
          color: var(--agent-text-secondary); font-size: 12.5px; font-weight: 650;
          text-decoration: none; transition: border-color .16s ease, color .16s ease;
        }
        .cw-rowadd:hover, .cw-rowadd:focus-visible { border-color: var(--agent-coral); color: var(--agent-coral-deep); outline: none; }
        /* Hide the whole "+ Add sale" button on mobile (not just its label) — it
           squeezed the row; the client is one tap away and has add-sale inside. */
        @media (max-width: 760px) { .cw-rowadd { display: none; } }
        .cw-logo { width: 52px; height: 52px; border-radius: 14px; overflow: hidden; flex-shrink: 0; border: 0.5px solid var(--agent-border-subtle); display: grid; place-items: center; }
        .cw-logo img { width: 100%; height: 100%; object-fit: contain; display: block; padding: 6px; box-sizing: border-box; }
        .cw-main { min-width: 0; flex: 1; }
        .cw-name { font-size: 16px; font-weight: 760; letter-spacing: -0.01em; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cw-metarow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 1px; }
        .cw-meta { font-size: 12.5px; color: var(--agent-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
        .cw-mstats { display: flex; gap: 26px; flex-shrink: 0; }
        .cw-mstats .ms { text-align: right; }
        .cw-mstats .n { font-size: 16.5px; font-weight: 800; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; line-height: 1; }
        .cw-mstats .l { font-size: 10px; color: var(--agent-text-faint, var(--agent-text-muted)); margin-top: 4px; }
        /* Status as plain text (no pill background), level with the name (#186). */
        .cw-status { font-size: 11px; font-weight: 650; letter-spacing: 0.01em; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }
        .cw-status.active { color: var(--agent-success, #2F7D53); }
        .cw-status.invite { color: #B5831E; }
        :root[data-theme="dark"] .cw-status.invite { color: #E0B050; }
        .cw-status .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .cw-chev { color: var(--agent-text-muted); flex-shrink: 0; transition: transform .2s, color .2s; }
        .cw-row:hover .cw-chev { transform: translateX(3px); color: var(--agent-coral-deep, #E2452A); }
        @media (max-width: 760px) { .cw-mstats { display: none; } }

        /* Removed (archived) clients — greyed, non-navigating, reinstate-only. */
        .cw-removed { margin-top: 22px; }
        .cw-removed .cw-label { margin-bottom: 12px; }
        .cw-row.removed { cursor: default; opacity: 0.62; }
        .cw-row.removed:hover { transform: none; border-color: var(--agent-border-subtle); box-shadow: none; }
        .cw-row.removed .cw-logo { filter: grayscale(1); }
        .cw-reinstate {
          display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
          height: 34px; padding: 0 13px; border-radius: 10px; cursor: pointer;
          border: 1px solid var(--agent-border-default); background: var(--agent-surface);
          color: var(--agent-text-secondary); font-size: 12.5px; font-weight: 650;
          transition: border-color 160ms ease, color 160ms ease;
        }
        .cw-reinstate:hover:not(:disabled) { border-color: var(--agent-coral); color: var(--agent-coral-deep); }
        .cw-reinstate:disabled { opacity: 0.6; cursor: default; }
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
        <SheetBandHeader icon={<UserPlus size={18} weight="bold" />} title="Add a client" subtitle="Add an estate agent to your book." />
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

        <div className="cwm-field">
          <label className="cwm-label" htmlFor="cwm-fee">Your fee per sale <span className="cwm-opt">optional</span></label>
          <div className="cwm-money">
            <span className="cwm-money-sym">£</span>
            <input id="cwm-fee" className="agent-input" inputMode="numeric" value={f.feePounds} onChange={(e) => f.setFeePounds(e.target.value.replace(/[^0-9]/g, ""))} placeholder="300" maxLength={9} />
          </div>
          <p className="cwm-feehint">A flat amount for every sale you progress for them. Prefer tiered or % pricing? Set it on their page. You&rsquo;ll need a fee set before you can add a sale.</p>
        </div>

        {f.emailInvalid && <p className="cwm-err">Enter a valid email address.</p>}
        {f.error && <p className="cwm-err">{f.error}</p>}
        <p className="cwm-help">We&rsquo;ll email them an invite to set up their login. They&rsquo;ll only be able to see their own sales.</p>
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
        .cwm-opt { font-weight: 400; font-size: 11px; color: var(--agent-text-muted); margin-left: 4px; }
        .cwm-money { position: relative; }
        .cwm-money-sym { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--agent-text-muted); font-weight: 600; pointer-events: none; }
        .cwm-money .agent-input { padding-left: 24px; }
        .cwm-feehint { margin: 7px 0 0; font-size: 11.5px; color: var(--agent-text-muted); line-height: 1.5; }
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

// ── Business settings modal ──────────────────────────────────────────────────
// Owner-only. Sets the short display name used in tight UI (the agent file's
// "Managed by …" badge). Blank clears the override so the full name is used.

function BusinessSettingsModal({ business, onClose }: { business: { name: string; shortName: string | null }; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(business.shortName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function save() {
    setError(null);
    startSave(async () => {
      const res = await updateBusinessShortNameAction(value);
      if (res.ok) { router.refresh(); onClose(); }
      else setError(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} ariaLabel="Business settings" size="md" closeTone="onDark">
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader iconBare icon={<Gear size={24} weight="bold" />} title="Business settings" subtitle="How your business appears to the agents you work with." />
      </Modal.Header>

      <Modal.Body>
        <div>
          <label className="bsm-label" htmlFor="bsm-short">Short display name</label>
          <input id="bsm-short" className="agent-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={business.name} maxLength={40} />
          <p className="bsm-help">
            Your full business name is <strong>{business.name}</strong>. In tight spots, like the &ldquo;Managed by&rdquo; badge on an agent&rsquo;s file, we&rsquo;ll show this shorter name instead. Leave it blank to use your full name.
          </p>
        </div>
        {error && <p className="bsm-err">{error}</p>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" size="md" className="bsm-primary" onClick={save} loading={saving}>Save</Button>
      </Modal.Footer>

      <style>{`
        .bsm-label { display: block; font-size: 12px; font-weight: 600; color: var(--agent-text-secondary); margin-bottom: 6px; }
        .bsm-help { margin: 10px 0 0; font-size: 12px; color: var(--agent-text-muted); line-height: 1.5; }
        .bsm-help strong { color: var(--agent-text-secondary); font-weight: 600; }
        .bsm-err { margin: 12px 0 0; font-size: 12.5px; color: #C7401F; }
        .bsm-primary { gap: 8px; background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .bsm-primary:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .bsm-primary:active:not(:disabled) { transform: scale(0.98); }
      `}</style>
    </Modal>
  );
}
