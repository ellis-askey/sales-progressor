"use client";

// /dev/chain-solicitors — proposed chain-card improvement: a "Solicitors" middle
// row (buyer's + seller's solicitor) between the header and the steps, its own
// divider above and below. Info only, per-viewer (like the 9-step gate): it
// records what WE know about a neighbour's solicitors, never touching the real
// file or the stub. Two columns collapse to one on narrow cards.
//
// Uses the REAL chain card chrome (ChainMapPanel's .cmp-* classes from
// globals.css) + the real PropertyThumb and ChainStepTicks, so it's the same
// card as the app. Fully interactive mock, no backend.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ChainStepTicks } from "@/components/chain/ChainStepTicks";
import { DesignLabToggle } from "@/components/glass/DesignLabToggle";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import { User, Phone, EnvelopeSimple, Briefcase, PencilSimple, Plus } from "@phosphor-icons/react";

type Sol = { firm: string; handler: string; phone: string; email: string };
type Side = "buyer" | "seller";

// ── solicitor cell ─────────────────────────────────────────────────────────────
function SolCell({ side, value, onSave, onClear }: {
  side: Side; value: Sol | null; onSave: (s: Sol) => void; onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Sol>(value ?? { firm: "", handler: "", phone: "", email: "" });
  const heading = side === "buyer" ? "Buyer's solicitor" : "Seller's solicitor";
  // Design Lab: one shared tag so a pick restyles every solicitor container.
  const glass = useGlassTag("chain-sol-cell", "Chain · solicitor cell");
  const box = (extra?: CSSProperties): CSSProperties =>
    glass.picked ? { padding: "11px 13px", borderRadius: 11, ...extra } : { ...cellStyle, ...extra };

  function start() { setDraft(value ?? { firm: "", handler: "", phone: "", email: "" }); setEditing(true); }
  function save() { if (!draft.firm.trim()) return; onSave(draft); setEditing(false); }

  const headRow = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
      <span style={{ fontSize: 11.5, fontWeight: 650, color: "var(--agent-text-muted)" }}>{heading}</span>
      {value && !editing && (
        <button type="button" onClick={start} className="cmp-act" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--agent-text-muted)" }}>
          <PencilSimple size={12} /> Edit
        </button>
      )}
    </div>
  );

  if (editing) {
    const field = (ph: string, k: keyof Sol, type = "text") => (
      <input value={draft[k]} type={type} placeholder={ph} className="agent-field"
        style={{ fontSize: 12.5, padding: "6px 9px", width: "100%", fontFamily: "inherit" }}
        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
    );
    return (
      <div {...glass.props} className={glass.className} style={box()}>
        {headRow}
        <div style={{ display: "grid", gap: 6 }}>
          {field("Firm name", "firm")}
          {field("Case handler", "handler")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {field("Phone", "phone", "tel")}
            {field("Email", "email", "email")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
            <button type="button" onClick={save} disabled={!draft.firm.trim()} className="agent-btn agent-btn-xs agent-btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="cmp-act" style={{ fontSize: 11.5, color: "var(--agent-text-secondary)" }}>Cancel</button>
            {value && <button type="button" onClick={() => { onClear(); setEditing(false); }} className="cmp-act" style={{ fontSize: 11.5, color: "var(--agent-danger)", marginLeft: "auto" }}>Remove</button>}
          </div>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div {...glass.props} className={glass.className} style={box({ borderStyle: glass.picked ? undefined : "dashed", display: "flex", flexDirection: "column" })}>
        {headRow}
        <button type="button" onClick={start} className="cmp-act cmp-act--primary" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, alignSelf: "flex-start", marginTop: 2 }}>
          <Plus size={12} weight="bold" /> Add {side === "buyer" ? "buyer's" : "seller's"} solicitor
        </button>
      </div>
    );
  }

  const line = (icon: ReactNode, text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--agent-text-secondary)", minWidth: 0 }}>
      <span style={{ color: "var(--agent-text-muted)", flexShrink: 0, display: "inline-flex" }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );

  return (
    <div {...glass.props} className={glass.className} style={box()}>
      {headRow}
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: "var(--agent-coral-deep)", flexShrink: 0, display: "inline-flex" }}><Briefcase size={14} weight="fill" /></span>
          <span style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.firm}</span>
        </div>
        {value.handler && line(<User size={13} />, value.handler)}
        {value.phone && line(<Phone size={13} />, value.phone)}
        {value.email && line(<EnvelopeSimple size={13} />, value.email)}
      </div>
    </div>
  );
}

const cellStyle: CSSProperties = {
  padding: "11px 13px", borderRadius: 11,
  border: "0.5px solid var(--agent-border-default)",
  background: "var(--agent-surface-elevated)",
};

// ── the solicitors middle row ───────────────────────────────────────────────────
function SolicitorsRow({ initial }: { initial: { buyer: Sol | null; seller: Sol | null } }) {
  const [sols, setSols] = useState(initial);
  return (
    <div style={{ margin: "0 12px", padding: "12px 0", borderTop: "1px solid var(--agent-border-subtle)", borderBottom: "1px solid var(--agent-border-subtle)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        <SolCell side="buyer" value={sols.buyer} onSave={(s) => setSols((p) => ({ ...p, buyer: s }))} onClear={() => setSols((p) => ({ ...p, buyer: null }))} />
        <SolCell side="seller" value={sols.seller} onSave={(s) => setSols((p) => ({ ...p, seller: s }))} onClear={() => setSols((p) => ({ ...p, seller: null }))} />
      </div>
    </div>
  );
}

const ALL_STEPS = ["dcp_issued", "searches_ordered", "finances_arranged", "searches_received", "enquiries_raised", "enquiries_satisfied", "contracts_issued", "seller_signed_returned", "buyer_signed_returned"];

// ── a chain card (real .cmp-* chrome) ───────────────────────────────────────────
function InvitedCard() {
  const [done, setDone] = useState<string[]>(["dcp_issued", "searches_ordered"]);
  return (
    <div className="cmp-rowwrap">
      <div className="cmp-rowline">
        <div className="cmp-row" style={{ cursor: "default" }}>
          <span className="cmp-num" style={{ background: "#e0a43b" }}>2</span>
          <PropertyThumb photoUrl={null} size={40} />
          <span className="cmp-txt">
            <span className="cmp-l1">Plot 213</span>
            <span className="cmp-l2">Derbyshire, DE73 6AU</span>
            <span className="cmp-meta">
              <span className="cmp-status" style={{ color: "#b8860b" }}>Invited</span>
              <span className="cmp-agency">· Bellway New Homes</span>
            </span>
            <span className="cmp-submeta">125d ago</span>
          </span>
        </div>
        <div className="cmp-rowtools">
          <button type="button" className="cmp-chevron"><span aria-hidden>▾</span></button>
          <button type="button" className="cmp-menu-btn">⋯</button>
        </div>
      </div>

      <SolicitorsRow initial={{
        buyer: { firm: "Hartley & Co", handler: "Ms R. Okafor", phone: "01332 553221", email: "r.okafor@hartley.co.uk" },
        seller: null,
      }} />

      <div className="cmp-acts" style={{ borderTop: "none", paddingTop: 0, marginTop: 6 }}>
        <div className="cmp-steps cmp-steps--inline">
          <ChainStepTicks steps={done} onToggle={(k) => setDone((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k])} />
        </div>
        <button type="button" className="cmp-act cmp-act--normal">Resend invite</button>
      </div>
    </div>
  );
}

function ClaimedCard() {
  return (
    <div className="cmp-rowwrap">
      <div className="cmp-rowline">
        <div className="cmp-row" style={{ cursor: "default" }}>
          <span className="cmp-num" style={{ background: "var(--agent-coral)" }}>1</span>
          <PropertyThumb photoUrl={null} size={40} />
          <span className="cmp-txt">
            <span className="cmp-l1">118 Hadley Grange</span>
            <span className="cmp-l2">Harlow, CM17 9PH</span>
            <span className="cmp-meta">
              <span className="cmp-status" style={{ color: "#2f9e5f" }}>Claimed</span>
              <span className="cmp-claimer">by Danny Bailey</span>
            </span>
          </span>
        </div>
        <div className="cmp-rowtools">
          <button type="button" className="cmp-chevron"><span aria-hidden>▾</span></button>
          <button type="button" className="cmp-menu-btn">⋯</button>
        </div>
      </div>

      <SolicitorsRow initial={{
        buyer: { firm: "Dawson Legal", handler: "Mr T. Field", phone: "020 7946 1123", email: "tfield@dawson.co.uk" },
        seller: { firm: "Carter Rowe LLP", handler: "Mrs J. Carter", phone: "0161 448 2210", email: "" },
      }} />

      <div className="cmp-progress">
        <span className="cmp-pct">77%</span>
        <span className="cmp-bar"><i style={{ width: "77%" }} /></span>
        <span className="cmp-price">Price TBC</span>
      </div>
      <div className="cmp-acts">
        <button type="button" className="cmp-act cmp-act--primary">Open file →</button>
      </div>
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? "var(--agent-coral)" : "var(--agent-border-default)"}`, background: active ? "var(--agent-coral-bg-tint)" : "var(--agent-surface-elevated)", color: active ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)" }}>{children}</button>
  );
}

export default function Page() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "custom";
    return () => { document.documentElement.dataset.theme = "custom"; };
  }, [dark]);

  return (
    <div style={{ minHeight: "100vh", padding: "32px 20px 80px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: "0 0 4px" }}>Chain card — solicitors row</h1>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
          Real chain-card chrome (same .cmp-* card as the app) with a new <strong>Solicitors</strong> row between the header and the steps, its own divider above and below. Info only, your private note on a neighbour&rsquo;s solicitors. Two columns collapse to one as the card narrows. Add/edit is live.
        </p>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", padding: "14px 16px", borderRadius: 12, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)", marginBottom: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agent-text-muted)" }}>Theme</span>
            <div style={{ display: "flex", gap: 6 }}>
              <SegBtn active={!dark} onClick={() => setDark(false)}>Light</SegBtn>
              <SegBtn active={dark} onClick={() => setDark(true)}>Dark</SegBtn>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: "auto" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agent-text-muted)" }}>Design Lab</span>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--agent-text-secondary)" }}>
              <DesignLabToggle />
              <span>Pick the solicitor container</span>
            </div>
          </div>
        </div>

        <div className="cmp-list" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <InvitedCard />
          <ClaimedCard />
        </div>
      </div>
    </div>
  );
}
