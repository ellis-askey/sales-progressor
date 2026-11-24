"use client";

// /dev/chain-email-audience — the "less brutal" proposal: no mode toggle. The To
// dropdown keeps CHAIN AGENTS and gains a second SOLICITORS eyebrow listing every
// on-file chain solicitor, DEDUPED by email (the same firm acts as a seller's
// solicitor on one link and the buyer's on the adjacent link, so it must collapse
// to one row). You freely pick agents, solicitors, or both. In the real flow this
// is a second grouped list fed into the composer's existing recipient dropdown.
// Fully interactive mock, no backend. Flip light/dark top-right.

import { useEffect, useState } from "react";
import { PaperPlaneTilt, Briefcase, X, CaretDown } from "@phosphor-icons/react";

type Rec = { id: string; name: string; sub: string; email: string };

// From the real composer screenshot.
const AGENTS: Rec[] = [
  { id: "a1", name: "Jack Dye", sub: "Akeman Residential", email: "jack@akeman-residential.co.uk" },
  { id: "a2", name: "Sarah Warrington", sub: "Nash Partnership", email: "sarah.warrington@nashpartnership.co.uk" },
  { id: "a3", name: "Phil Gormley", sub: "Sterling Homes", email: "philgormley@sterlinghomes.co.uk" },
  { id: "a4", name: "Taylor Kay", sub: "Akeman Residential", email: "taylor@akeman-residential.co.uk" },
  { id: "a5", name: "Philippa Scott", sub: "Roger Platt", email: "philippa.scott@rogerplatt.co.uk" },
];

// On-file chain solicitors. NOTE two raw entries share sarah.hunt@pictons.co.uk
// (Pictons is the seller's solicitor on one sale and the buyer's on the onward
// purchase) — deduped to a single row below.
const SOLICITORS_RAW: Rec[] = [
  { id: "s1", name: "Sarah Hunt", sub: "Pictons · 2 Demask Close seller's", email: "sarah.hunt@pictons.co.uk" },
  { id: "s2", name: "Sarah Hunt", sub: "Pictons · 16 Deans Furlong buyer's", email: "sarah.hunt@pictons.co.uk" },
  { id: "s3", name: "Laura G", sub: "Bendless Solicitors · Oldbury buyer's", email: "laurag@bendlesssolicitors.co.uk" },
  { id: "s4", name: "David Hart", sub: "Hart & Co · 7 Mill Lane seller's", email: "dhart@hartco.co.uk" },
];
function dedupe(list: Rec[]): Rec[] {
  const seen = new Set<string>();
  return list.filter((r) => { const k = r.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}
const SOLICITORS = dedupe(SOLICITORS_RAW);

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "");
}

export default function Page() {
  const [dark, setDark] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);

  const toggle = (id: string) => setAdded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const all = [...AGENTS, ...SOLICITORS];
  const chips = all.filter((r) => added.has(r.id));

  const Row = ({ r, sol }: { r: Rec; sol?: boolean }) => {
    const on = added.has(r.id);
    return (
      <div onClick={() => toggle(r.id)}
        style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 14px", cursor: "pointer", background: on ? "var(--agent-coral-bg-tint)" : "transparent" }}
        onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLElement).style.background = "var(--agent-hover-tint)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = on ? "var(--agent-coral-bg-tint)" : "transparent"; }}>
        <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: sol ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)", background: sol ? "var(--agent-coral-bg-tint)" : "var(--agent-surface-overlay)" }}>
          {sol ? <Briefcase size={15} weight="fill" /> : initials(r.name)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email}</p>
        </div>
        {on && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)" }}>Added</span>}
      </div>
    );
  };

  const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <p style={{ margin: 0, padding: "10px 14px 5px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>{children}</p>
  );

  return (
    <div style={{ minHeight: "100vh", padding: "32px 20px", display: "grid", gridTemplateColumns: "minmax(0,560px) 290px", gap: 26, justifyContent: "center", alignItems: "start" }}>
      {/* Composer */}
      <div style={{ borderRadius: 18, overflow: "hidden", background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-default)", boxShadow: "0 30px 70px -28px rgba(40,24,16,.5)" }}>
        {/* Coral header */}
        <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,var(--agent-coral),var(--agent-coral-deep))", color: "#fff", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>New email</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.9 }}>Sent from your own address · logged to the file</p>
          </div>
          <X size={18} style={{ cursor: "pointer", opacity: 0.9 }} />
        </div>

        <div style={{ padding: "16px 20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* To field + chips */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", paddingTop: 9, width: 20 }}>To</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: chips.length ? "6px 8px" : "0", border: "1.5px solid var(--agent-coral)", borderRadius: 10, background: "var(--agent-surface-base, #fff)" }}>
                {chips.map((r) => (
                  <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 7px 3px 8px", borderRadius: 999, background: "var(--agent-coral-bg-tint)", color: "var(--agent-coral-deep)", fontSize: 12, fontWeight: 600 }}>
                    {r.name}
                    <X size={12} weight="bold" style={{ cursor: "pointer" }} onClick={() => toggle(r.id)} />
                  </span>
                ))}
                <input placeholder={chips.length ? "" : "Add people or type an email…"} style={{ flex: 1, minWidth: 120, border: "none", outline: "none", background: "transparent", fontSize: 13, padding: chips.length ? "4px 2px" : "11px 12px", color: "var(--agent-text-primary)" }} />
              </div>

              {/* The dropdown — CHAIN AGENTS + the new SOLICITORS eyebrow */}
              <div style={{ marginTop: 6, border: "0.5px solid var(--agent-border-default)", borderRadius: 12, overflow: "hidden", boxShadow: "0 18px 40px -22px rgba(40,24,16,.4)", maxHeight: 360, overflowY: "auto", background: "var(--agent-surface-elevated)" }}>
                <Eyebrow>Chain agents</Eyebrow>
                {AGENTS.map((r) => <Row key={r.id} r={r} />)}
                <div style={{ height: 1, background: "var(--agent-border-subtle)", margin: "6px 0" }} />
                <Eyebrow>Solicitors</Eyebrow>
                {SOLICITORS.map((r) => <Row key={r.id} r={r} sol />)}
              </div>
            </div>
            <span style={{ display: "flex", gap: 10, paddingTop: 9, fontSize: 12.5, color: "var(--agent-text-muted)" }}>
              <span style={{ cursor: "pointer" }}>Cc</span><span style={{ cursor: "pointer" }}>Bcc</span>
            </span>
          </div>

          {/* Subject (collapsed/stylised) */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", width: 20 }}>Re</span>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--agent-border-default)", fontSize: 13, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Update on the chain: 16 Deans Furlong, 2 Demask Close, Oldbury On Seven…</div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: "0.5px solid var(--agent-border-subtle)", marginTop: 2 }}>
            <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>From <b style={{ color: "var(--agent-text-secondary)" }}>Ellis at Akeman Residential</b></span>
            <button type="button" disabled={!chips.length} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none", cursor: chips.length ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, color: "#fff", background: chips.length ? "var(--agent-coral-deep)" : "var(--agent-text-tertiary)" }}>
              <PaperPlaneTilt size={15} weight="fill" /> Send{chips.length ? ` to ${chips.length}` : ""} <CaretDown size={12} weight="bold" style={{ opacity: 0.8 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Explainer */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <button type="button" onClick={() => setDark((v) => !v)} style={{ alignSelf: "flex-end", fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-secondary)", cursor: "pointer" }}>{dark ? "Dark" : "Light"}</button>
        <div className="agent-glass" style={{ borderRadius: 14, padding: "16px 16px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>No toggle, just a second group</p>
          {[
            "The To dropdown keeps CHAIN AGENTS and adds a SOLICITORS eyebrow below it.",
            "Pick any mix — agents, solicitors, or both — in one send. Nothing else about the composer changes.",
            "Solicitors are deduped by email: Pictons shows once even though it's the seller's on one sale and the buyer's on the onward.",
          ].map((t, i) => (
            <p key={i} style={{ margin: "0 0 9px", fontSize: 12, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>{t}</p>
          ))}
          <p style={{ margin: "4px 0 0", paddingTop: 10, borderTop: "0.5px solid var(--agent-border-subtle)", fontSize: 11.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>Try it: 4 raw solicitor entries → <b style={{ color: "var(--agent-text-secondary)" }}>3 rows</b> after dedupe.</p>
        </div>
      </aside>
    </div>
  );
}
