"use client";

// /dev/partners-rework — proposed Partners empty-state redesign, our styling
// (coral broker / blue solicitors, glass, real partners-hero roof art). Visual
// only; the CTAs/search are inert here. Blocks in prod.

import { useState } from "react";
import { notFound } from "next/navigation";
import {
  Buildings, Briefcase, Scales, FolderSimple, Plus,
  MagnifyingGlass, ChartLineUp, Info,
  PencilSimple, ArrowSquareOut, Phone, EnvelopeSimple, CaretRight, CaretDown, CaretUp, ArrowsDownUp,
} from "@phosphor-icons/react";
import { HeroArt } from "@/components/agent/HeroArt";

const CORAL = "var(--agent-coral-deep)";
const CORAL_RGB = "var(--agent-coral-rgb)";
const BLUE = "#2f74e0";
const BLUE_RGB = "59,130,246";

export default function PartnersReworkPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dark, setDark] = useState(false);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (typeof document !== "undefined") {
      if (next) document.documentElement.dataset.theme = "dark";
      else document.documentElement.removeAttribute("data-theme");
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 80px" }}>
      {/* Dev toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Prototype · /dev · Partners empty state</span>
        <button onClick={toggle} className="agent-btn agent-btn-secondary agent-btn-sm">{dark ? "☀ Light" : "☾ Dark"}</button>
      </div>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--agent-radius-xl)", minHeight: 128, padding: "26px 28px", marginBottom: 20 }}>
        <HeroArt light="/partners-hero.png" dark="/partners-hero-dark.png" maxWidth="42%" maskStart="46%" />
        <div style={{ position: "relative", maxWidth: 520 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "var(--agent-tracking-tight)", color: "var(--agent-text-primary)", lineHeight: 1.1 }}>Your partners</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>Manage your preferred broker and recommended solicitors in one place.</p>
        </div>
      </div>

      {/* ── Cards ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
        {/* Preferred mortgage broker */}
        <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <CardHead
            tile={<Buildings size={24} weight="regular" />}
            rgb={CORAL_RGB} fg={CORAL}
            title="Preferred mortgage broker"
            desc="Set your preferred broker. Their details will be pre-filled on new sales."
            pill={<StatusPill tone="muted" dot>Not set up</StatusPill>}
          />
          <EmptyBody
            rgb={CORAL_RGB} fg={CORAL}
            icon={<Briefcase size={34} weight="duotone" />}
            badge
            heading="Add your preferred broker"
            sub="Save their details once and we'll pre-fill them on new sales, including your referral fee."
            action={<button className="agent-btn agent-btn-primary agent-btn-md" style={{ width: "100%", justifyContent: "center" }}><Plus size={16} weight="bold" /> Add mortgage broker</button>}
          />
          {/* Referral-income footer — hairline divider + crisp coral icon chip */}
          <div style={{ marginTop: 2, paddingTop: 16, borderTop: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: CORAL, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 3px 10px rgba(${CORAL_RGB}, 0.32)`,
            }}>
              <ChartLineUp size={18} weight="bold" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Track your referral income</p>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.4 }}>Referral fees are included in your income analytics.</p>
            </div>
            <span style={{ color: "var(--agent-text-muted)", flexShrink: 0, display: "flex" }} title="Set a default fee when you add the broker"><Info size={17} weight="regular" /></span>
          </div>
        </div>

        {/* Recommended solicitors */}
        <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <CardHead
            tile={<Scales size={24} weight="regular" />}
            rgb={BLUE_RGB} fg={BLUE}
            title="Recommended solicitors"
            desc="Add the firms you recommend to clients and set a default referral fee."
            pill={<StatusPill tone="muted">0 firms</StatusPill>}
          />
          <EmptyBody
            rgb={BLUE_RGB} fg={BLUE}
            icon={<FolderSimple size={34} weight="duotone" />}
            heading="Your recommended firms will appear here"
            sub="Build your list of trusted solicitors and set referral fees for each firm."
            action={
              <label style={{ position: "relative", display: "block", width: "100%" }}>
                <MagnifyingGlass size={16} weight="bold" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)" }} />
                <input
                  placeholder="Search or add a solicitor firm…"
                  className="crvx-input"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "11px 12px 11px 38px",
                    fontSize: 13.5, borderRadius: 11, outline: "none", fontFamily: "inherit",
                    color: "var(--agent-text-primary)", background: "var(--agent-surface-glass)",
                    border: "1px solid var(--agent-border-default)", transition: "border-color 140ms ease",
                  }}
                />
              </label>
            }
          />
        </div>
      </div>

      {/* ── Next stage: the add forms (what the CTAs open) ───────── */}
      <div style={{ marginTop: 44 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 12px" }}>Next stage · the add forms</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, alignItems: "start" }}>

          {/* Broker form */}
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
            <FormHead title="Preferred mortgage broker" sub="Add your preferred broker for new sales." />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Firm name" req><input className="pf-input" defaultValue="Mortgage Masters Ltd" /></Field>
              <Field label="Website" opt><input className="pf-input" defaultValue="https://mortgagemasters.co.uk" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Contact name" req><input className="pf-input" defaultValue="James Morris" /></Field>
                <Field label="Phone" req><input className="pf-input" defaultValue="07700 900 000" /></Field>
              </div>
              <Field label="Email" req><input className="pf-input" defaultValue="james@mortgagemasters.co.uk" /></Field>
              <FeeRow cta="Save broker" />
            </div>
          </div>

          {/* Solicitor form */}
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
            <FormHead title="Recommended solicitors" sub="Add a firm to your recommended list." />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: BLUE }}>Selected firm</p>
                <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>A V Rillo &amp; Co Solicitors</p>
              </div>
              <button type="button" className="pf-change">Change</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Case handler name" req><input className="pf-input" defaultValue="Sarah Jones" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Phone" req><input className="pf-input" defaultValue="01234 567890" /></Field>
                <Field label="Email" req><input className="pf-input" defaultValue="sarah@avrillo.co.uk" /></Field>
              </div>
              <FeeRow cta="Add solicitor" />
            </div>
          </div>

        </div>
      </div>

      {/* ── Final state: set-up cards + live-files directory ─────── */}
      <div style={{ marginTop: 44 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 12px" }}>Final state · set up + live files</p>

        {/* Populated cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, alignItems: "start" }}>
          {/* Broker — filled */}
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>Preferred mortgage broker</p>
              <button type="button" className="conv-icon-btn" title="Edit"><PencilSimple size={17} /></button>
            </div>
            <div style={{ borderTop: "1px solid var(--agent-border-subtle)", margin: "14px 0 16px" }} />
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                  Mortgage Masters Ltd <ArrowSquareOut size={15} weight="bold" style={{ color: CORAL }} />
                </p>
                <p style={{ margin: "2px 0 12px", fontSize: 13, color: "var(--agent-text-secondary)" }}>James Morris</p>
                <p style={{ margin: "0 0 7px", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--agent-text-secondary)" }}><Phone size={15} weight="regular" style={{ color: "var(--agent-text-muted)" }} /> 07700 900 000</p>
                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--agent-text-secondary)" }}><EnvelopeSimple size={15} weight="regular" style={{ color: "var(--agent-text-muted)" }} /> james@mortgagemasters.co.uk</p>
              </div>
              <div style={{ borderLeft: "1px solid var(--agent-border-subtle)", paddingLeft: 20, flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 11.5, color: "var(--agent-text-muted)" }}>Referral fee</p>
                <p style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>£250 + VAT</p>
              </div>
            </div>
          </div>

          {/* Solicitors — filled */}
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>Recommended solicitors</p>
              <button type="button" className="pf-addfirm"><Plus size={14} weight="bold" /> Add firm</button>
            </div>
            <div style={{ borderTop: "1px solid var(--agent-border-subtle)", margin: "14px 0 4px" }} />
            <button type="button" className="conv-firm-row" style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 8px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderRadius: 10 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>A V Rillo &amp; Co Solicitors</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>Sarah Jones</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>£250 + VAT</span>
                <CaretRight size={15} weight="bold" style={{ color: "var(--agent-text-muted)" }} />
              </div>
            </button>
          </div>
        </div>

        {/* Conveyancers directory */}
        <div style={{ marginTop: 30 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>Conveyancers</h2>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-muted)" }}>54 firms</span>
          </div>
          <p style={{ margin: "4px 0 16px", fontSize: 13.5, color: "var(--agent-text-secondary)" }}>Solicitor firms and contacts associated with your sales.</p>

          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ position: "relative", flex: "1 1 320px", minWidth: 0 }}>
              <MagnifyingGlass size={16} weight="bold" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)" }} />
              <input className="pf-input" placeholder="Search firms, contacts or addresses…" style={{ paddingLeft: 38 }} />
            </label>
            <div style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 11, background: "var(--agent-surface-glass)", border: "1px solid var(--agent-border-subtle)" }}>
              <span style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: CORAL, background: `rgba(${CORAL_RGB},0.1)` }}>All firms</span>
              <span style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>With active files</span>
            </div>
            <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 7 }}><ArrowsDownUp size={14} weight="bold" /> Sort: Name <CaretDown size={12} weight="bold" /></button>
          </div>

          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.6fr) minmax(0,0.8fr)", gap: 16, padding: "12px 20px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", borderBottom: "1px solid var(--agent-border-subtle)" }}>
              <span>Firm &amp; contact</span><span>Associated sales</span><span style={{ textAlign: "right" }}>Active files</span>
            </div>
            <ConvRow firm="Abbey Court Solicitors" contact="Edward Halsall" sales={[{ addr: "18 The Avenue, Clevedon, BS21 7EA", role: "Purchaser" }]} active={1} />
            <ConvRow firm="AMD Solicitors" contact="Claudia Plessier" email="claudiaplessier@amdsolicitors.com" phone="01179735647" sales={[{ addr: "52a Brighton Crescent, Bristol, BS3 3PE", role: "Vendor" }, { addr: "14 Oakwood Road, Bristol, BS9 4RT", role: "Purchaser" }, { addr: "7 Maple Drive, Bristol, BS8 1HB", role: "Vendor" }]} active={3} defaultOpen />
            <ConvRow firm="Ashfords LLP" contact="Stacey Randell" sales={[{ addr: "9 Kingswood Lane, Bristol, BS15 1DP", role: "Purchaser" }]} active={1} last />
          </div>
        </div>

        <style>{`
          .conv-icon-btn{width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--agent-text-muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 140ms,color 140ms}
          .conv-icon-btn:hover{background:rgba(var(--agent-coral-rgb),0.1);color:var(--agent-coral-deep)}
          .pf-addfirm{display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:0;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--agent-coral-deep);text-decoration:none;transition:color 140ms}
          .pf-addfirm:hover{color:#C0381C}
          .conv-firm-row:hover{background:var(--agent-surface-glass)}
          .conv-row-head:hover{background:rgba(var(--agent-coral-rgb),0.045)}
        `}</style>
      </div>

      <style>{`
        .crvx-input:focus{border-color:${BLUE}}
        .crvx-input::placeholder{color:var(--agent-text-muted)}
        .pf-input{width:100%;box-sizing:border-box;padding:10px 12px;font-size:13.5px;border-radius:10px;outline:none;font-family:inherit;color:var(--agent-text-primary);background:var(--agent-surface-elevated);border:1px solid var(--agent-border-default);transition:border-color 140ms ease}
        .pf-input::placeholder{color:var(--agent-text-muted)}
        .pf-input:hover{border-color:var(--agent-coral-deep)}
        .pf-input:focus{border-color:#C0381C}
        .pf-check{width:20px;height:20px;border-radius:6px;flex-shrink:0;border:1.5px solid var(--agent-border-strong);background:transparent;display:inline-flex;align-items:center;justify-content:center;transition:background 140ms ease,border-color 140ms ease}
        .pf-check[data-checked="true"]{background:var(--agent-coral-deep);border-color:var(--agent-coral-deep)}
        .pf-tick{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:26;stroke-dashoffset:26;transition:stroke-dashoffset 240ms ease 40ms}
        .pf-check[data-checked="true"] .pf-tick{stroke-dashoffset:0}
        .pf-change{background:none;border:none;padding:0;cursor:pointer;font-size:13px;font-weight:600;color:var(--agent-coral-deep);text-decoration:none;transition:color 140ms ease}
        .pf-change:hover{color:#C0381C}
      `}</style>
    </div>
  );
}

// ── Add-form pieces ──────────────────────────────────────────────────
function FormHead({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)" }}>{sub}</p>
        </div>
        <button type="button" className="agent-btn agent-btn-ghost agent-btn-sm" style={{ flexShrink: 0 }}>Cancel</button>
      </div>
      <div style={{ borderTop: "1px solid var(--agent-border-subtle)", margin: "14px 0 16px" }} />
    </>
  );
}

function Field({ label, req, opt, children }: { label: string; req?: boolean; opt?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 5 }}>
        {label}
        {req && <span style={{ color: "#e5484d", marginLeft: 3 }}>*</span>}
        {opt && <span style={{ color: "var(--agent-text-muted)", fontWeight: 400, marginLeft: 5 }}>(optional)</span>}
      </span>
      {children}
    </label>
  );
}

function FeeRow({ cta }: { cta: string }) {
  return (
    <div>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 6 }}>
        Default referral fee <span style={{ color: "var(--agent-text-muted)", fontWeight: 400 }}>(optional)</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <input className="pf-input" defaultValue="£250" style={{ width: 96 }} />
        <VatPair />
        <button type="button" className="agent-btn agent-btn-primary agent-btn-md" style={{ marginLeft: "auto" }}>{cta}</button>
      </div>
    </div>
  );
}

function VatPair() {
  const [sel, setSel] = useState<"plus" | "inc">("plus");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <VatCheck label="+ VAT" checked={sel === "plus"} onClick={() => setSel("plus")} />
      <VatCheck label="inc VAT" checked={sel === "inc"} onClick={() => setSel("inc")} />
    </div>
  );
}

function VatCheck({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
      <span className="pf-check" data-checked={checked}>
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden><path className="pf-tick" d="M5 12.5l4.5 4.5L19 7" /></svg>
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-secondary)" }}>{label}</span>
    </button>
  );
}

// ── Conveyancers directory row (expandable) ──────────────────────────
type Sale = { addr: string; role: string };
function ConvRow({ firm, contact, sales, active, email, phone, defaultOpen, last }: {
  firm: string; contact: string; sales: Sale[]; active: number; email?: string; phone?: string; defaultOpen?: boolean; last?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const multi = sales.length > 1;
  return (
    <div style={{ borderBottom: last ? "none" : "1px solid var(--agent-border-subtle)", background: open ? `rgba(${CORAL_RGB},0.04)` : "transparent", transition: "background 140ms ease" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="conv-row-head" style={{ width: "100%", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1.6fr) minmax(0,0.8fr)", gap: 16, alignItems: "center", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{firm}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>{contact}</p>
        </div>
        <div style={{ minWidth: 0, fontSize: 13.5, color: "var(--agent-text-secondary)" }}>
          {multi
            ? <span style={{ fontWeight: 700, color: "var(--agent-text-primary)" }}>{sales.length} sales</span>
            : <span>{sales[0].addr} <span style={{ color: "var(--agent-text-muted)" }}>· {sales[0].role}</span></span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{active} active</span>
          {open ? <CaretUp size={15} weight="bold" style={{ color: CORAL }} /> : <CaretDown size={15} weight="bold" style={{ color: "var(--agent-text-muted)" }} />}
        </div>
      </button>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.9fr)", gap: 28, padding: "2px 20px 18px" }}>
          <div>
            <p style={{ margin: "0 0 9px", fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>Contact details</p>
            {email && <p style={{ margin: "0 0 7px", display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--agent-text-secondary)" }}><EnvelopeSimple size={15} style={{ color: "var(--agent-text-muted)" }} /> {email}</p>}
            {phone && <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--agent-text-secondary)" }}><Phone size={15} style={{ color: "var(--agent-text-muted)" }} /> {phone}</p>}
          </div>
          <div style={{ borderLeft: "1px solid var(--agent-border-subtle)", paddingLeft: 28 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>Associated sales ({sales.length})</p>
            {sales.map((s) => (
              <div key={s.addr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "7px 0", borderTop: "1px solid var(--agent-border-subtle)" }}>
                <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.addr}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                  <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>{s.role}</span>
                  <ArrowSquareOut size={15} weight="bold" style={{ color: CORAL }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card header: icon tile + title/desc + status pill ────────────────
function CardHead({ tile, rgb, fg, title, desc, pill }: {
  tile: React.ReactNode; rgb: string; fg: string; title: string; desc: string; pill: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{ flexShrink: 0, color: fg, display: "flex", alignItems: "center", marginTop: 1 }}>{tile}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{desc}</p>
      </div>
      <span style={{ flexShrink: 0 }}>{pill}</span>
    </div>
  );
}

// ── Centred empty body: big icon-circle, heading, sub, action ────────
function EmptyBody({ rgb, fg, icon, badge, heading, sub, action }: {
  rgb: string; fg: string; icon: React.ReactNode; badge?: boolean; heading: string; sub: string; action: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "20px 8px 8px" }}>
      <span style={{ position: "relative", display: "inline-flex" }}>
        <span style={{
          width: 86, height: 86, borderRadius: "50%", color: fg,
          background: `radial-gradient(circle at 50% 42%, rgba(${rgb},0.16), rgba(${rgb},0.06) 70%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</span>
        {badge && (
          <span style={{
            position: "absolute", right: -2, bottom: 2, width: 28, height: 28, borderRadius: "50%",
            background: fg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid var(--agent-surface-elevated)", boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
          }}><Plus size={14} weight="bold" /></span>
        )}
      </span>
      <div style={{ maxWidth: 320 }}>
        <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>{heading}</p>
        <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{sub}</p>
      </div>
      <div style={{ width: "100%", maxWidth: 320, marginTop: 4 }}>{action}</div>
    </div>
  );
}

// ── Status pill ──────────────────────────────────────────────────────
function StatusPill({ tone, dot, children }: { tone: "muted"; dot?: boolean; children: React.ReactNode }) {
  void tone;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
      color: "var(--agent-text-muted)", background: "var(--agent-surface-glass)",
      border: "1px solid var(--agent-border-subtle)", whiteSpace: "nowrap",
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-text-muted)", flexShrink: 0 }} />}
      {children}
    </span>
  );
}
